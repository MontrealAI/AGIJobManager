import { isAddress, type Abi, type Address, type PublicClient } from 'viem';
import { agiJobManagerAbi } from '@/abis/agiJobManager';

export const JOB_PAGE_SIZE = 50;
const MAX_UINT256 = (1n << 256n) - 1n;
type Reader = Pick<PublicClient, 'getBlock' | 'getChainId' | 'multicall'>;
type Target = { address: Address; chainId: number };
type Call = { functionName: string; args?: readonly bigint[] };
export type JobRecord = {
  id: bigint; employer: Address; agent: Address; payout: bigint; duration: bigint;
  assignedAt: bigint; completed: boolean; disputed: boolean; expired: boolean;
  completionRequested: boolean; completionRequestedAt: bigint; disputedAt: bigint;
  deadlines: readonly bigint[]; specUri: string | null; completionUri: string | null;
};
export type PlatformSummary = {
  owner: Address; paused: boolean; settlementPaused: boolean; nextJobId: bigint;
  completionReviewPeriod: bigint; disputeReviewPeriod: bigint; voteQuorum: bigint;
  requiredValidatorApprovals: bigint; requiredValidatorDisapprovals: bigint;
  withdrawableUSDC: bigint;
};

function requireValue(ok: unknown, message = 'The RPC returned incomplete job data. Retry before acting.'): asserts ok {
  if (!ok) throw new Error(message);
}
function uint(value: unknown): bigint {
  requireValue(typeof value === 'bigint' && value >= 0n && value <= MAX_UINT256);
  return value;
}
function bool(value: unknown): boolean { requireValue(typeof value === 'boolean'); return value; }
function address(value: unknown): Address { requireValue(typeof value === 'string' && isAddress(value)); return value; }
function tuple(value: unknown, length: number): unknown[] {
  requireValue(Array.isArray(value) && value.length === length); return value;
}
export function parseJobId(value: string): bigint {
  requireValue(/^(0|[1-9][0-9]{0,77})$/.test(value), 'Enter a whole job ID, such as 0 or 123.');
  const id = BigInt(value);
  requireValue(id <= MAX_UINT256, 'The job ID exceeds the contract limit.');
  return id;
}

async function atSnapshot<T>(client: Reader, target: Target, collect: (read: (calls: Call[]) => Promise<unknown[]>, block: bigint) => Promise<T>) {
  requireValue([1, 11155111].includes(target.chainId), 'Select a supported deployment chain: Ethereum or Sepolia.');
  requireValue(isAddress(target.address) && !/^0x0{40}$/i.test(target.address), 'Configure a verified manager address before loading live jobs. See Deployment.');
  requireValue(await client.getChainId() === target.chainId, 'The RPC network differs from the selected deployment.');
  const block = await client.getBlock({ blockTag: 'latest' });
  requireValue(typeof block.number === 'bigint' && block.number >= 0n && typeof block.hash === 'string' && /^0x[0-9a-f]{64}$/i.test(block.hash), 'The RPC did not return a mined block.');
  const blockNumber = block.number;
  const read = async (calls: Call[]) => {
    if (!calls.length) return [];
    const result = await client.multicall({
      contracts: calls.map(call => ({ address: target.address, abi: agiJobManagerAbi as Abi, ...call })),
      blockHash: block.hash, requireCanonical: true, allowFailure: false,
    });
    requireValue(result.length === calls.length);
    return result as unknown[];
  };
  const result = await collect(read, blockNumber);
  const finalBlock = await client.getBlock({ blockNumber });
  requireValue(finalBlock.hash === block.hash && finalBlock.number === blockNumber, 'The chain changed during this read. Refresh the snapshot.');
  requireValue(await client.getChainId() === target.chainId, 'The RPC network changed during this read.');
  return result;
}

function decodeJob(id: bigint, values: unknown[]): JobRecord {
  const c = tuple(values[0], 9), v = tuple(values[1], 5), d = tuple(values[2], 5);
  return {
    id, employer: address(c[0]), agent: address(c[1]), payout: uint(c[2]), duration: uint(c[3]),
    assignedAt: uint(c[4]), completed: bool(c[5]), disputed: bool(c[6]), expired: bool(c[7]),
    completionRequested: bool(v[0]), completionRequestedAt: uint(v[3]), disputedAt: uint(v[4]),
    deadlines: d.map(uint), specUri: null, completionUri: null,
  };
}
const jobCalls = (id: bigint): Call[] => ['getJobCore', 'getJobValidation', 'getJobDeadlines'].map(functionName => ({ functionName, args: [id] }));
const platformCalls = ['owner', 'paused', 'settlementPaused', 'nextJobId', 'completionReviewPeriod', 'disputeReviewPeriod', 'voteQuorum', 'requiredValidatorApprovals', 'requiredValidatorDisapprovals', 'withdrawableUSDC'];
function decodePlatform(v: unknown[]): PlatformSummary {
  requireValue(v.length === platformCalls.length);
  return { owner: address(v[0]), paused: bool(v[1]), settlementPaused: bool(v[2]), nextJobId: uint(v[3]),
    completionReviewPeriod: uint(v[4]), disputeReviewPeriod: uint(v[5]), voteQuorum: uint(v[6]),
    requiredValidatorApprovals: uint(v[7]), requiredValidatorDisapprovals: uint(v[8]), withdrawableUSDC: uint(v[9]) };
}

export function readPlatform(client: Reader, target: Target) {
  return atSnapshot(client, target, async read => decodePlatform(await read(platformCalls.map(functionName => ({ functionName })))));
}

/** Read at most 50 jobs, newest first. Job IDs stay bigint throughout. */
export function readJobPage(client: Reader, target: Target, before?: bigint) {
  return atSnapshot(client, target, async (read, blockNumber) => {
    const total = uint((await read([{ functionName: 'nextJobId' }]))[0]);
    const end = before === undefined ? total : uint(before);
    requireValue(end <= total, 'This page is outside the current job history. Return to the newest jobs.');
    const start = end > BigInt(JOB_PAGE_SIZE) ? end - BigInt(JOB_PAGE_SIZE) : 0n;
    const ids = Array.from({ length: Number(end - start) }, (_, i) => end - 1n - BigInt(i));
    const values = await read(ids.flatMap(jobCalls));
    const jobs = ids.map((id, i) => decodeJob(id, values.slice(i * 3, i * 3 + 3)));
    return { jobs, total, start, end, blockNumber, olderCursor: start > 0n ? start : null };
  });
}

/** Direct lookup never downloads preceding jobs. All displayed state shares a block. */
export function readJob(client: Reader, target: Target, jobId: string) {
  const id = parseJobId(jobId);
  return atSnapshot(client, target, async (read, blockNumber) => {
    const platform = decodePlatform(await read(platformCalls.map(functionName => ({ functionName }))));
    if (id >= platform.nextJobId) return { job: null, platform, blockNumber };
    const values = await read([...jobCalls(id), { functionName: 'getJobSpecURI', args: [id] }, { functionName: 'getJobCompletionURI', args: [id] }]);
    requireValue(typeof values[3] === 'string' && typeof values[4] === 'string');
    return { job: { ...decodeJob(id, values), specUri: values[3], completionUri: values[4] }, platform, blockNumber };
  });
}
