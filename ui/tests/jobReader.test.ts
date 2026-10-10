import { describe, it, expect, vi } from 'vitest';
import { createPublicClient, custom, encodeFunctionResult, decodeFunctionData, multicall3Abi, type PublicClient, type Abi } from 'viem';
import { mainnet } from 'viem/chains';
import { agiJobManagerAbi } from '../src/abis/agiJobManager';
import { JOB_PAGE_SIZE, parseJobId, readJob, readJobPage, readPlatform } from '../src/lib/web3/job-reader';

const address = '0x0000000000000000000000000000000000000001';
const zero = '0x0000000000000000000000000000000000000000';
const hash = `0x${'ab'.repeat(32)}`;
const target = { address, chainId: 1 } as const;
function fixture(total = 3n) {
  const results: Record<string, unknown> = {
    owner: address, paused: false, settlementPaused: false, nextJobId: total,
    completionReviewPeriod: 10n, disputeReviewPeriod: 20n, voteQuorum: 3n,
    requiredValidatorApprovals: 3n, requiredValidatorDisapprovals: 2n, withdrawableUSDC: 0n,
    getJobCore: [address, zero, 1000000n, 100n, 0n, false, false, false, 0n],
    getJobValidation: [false, 0n, 0n, 0n, 0n], getJobDeadlines: [1n, 2n, 3n, 4n, 5n],
    getJobSpecURI: 'ipfs://spec', getJobCompletionURI: 'https://example.com/delivery',
  };
  const rpc = {
    getChainId: vi.fn().mockResolvedValue(1),
    getBlock: vi.fn().mockResolvedValue({ number: 50n, hash }),
    multicall: vi.fn(async ({ contracts }: { contracts: { functionName: string }[] }) => contracts.map(c => results[c.functionName])),
  };
  return { rpc, client: rpc as unknown as PublicClient, results };
}
describe('bounded job snapshots', () => {
  it('loads at most 50 jobs and preserves IDs beyond Number precision', async () => {
    const total = 9007199254741100n;
    const { client, rpc } = fixture(total);
    const page = await readJobPage(client, target);
    expect(page.jobs).toHaveLength(JOB_PAGE_SIZE);
    expect(page.jobs[0].id).toBe(total - 1n);
    expect(page.jobs.at(-1)?.id).toBe(total - 50n);
    expect(page.olderCursor).toBe(total - 50n);
    expect(rpc.multicall.mock.calls.map(([c]) => c.contracts.length)).toEqual([1, 150]);
    for (const [call] of rpc.multicall.mock.calls) expect(call).toMatchObject({ blockHash: hash, requireCanonical: true, allowFailure: false });
  });
  it('includes job zero and honors the older-page boundary', async () => {
    const { client } = fixture(100n);
    const page = await readJobPage(client, target, 2n);
    expect(page.jobs.map(j => j.id)).toEqual([1n, 0n]);
    expect(page.olderCursor).toBeNull();
    await expect(readJobPage(client, target, 101n)).rejects.toThrow('outside');
  });
  it('does not issue a job batch for an empty deployment', async () => {
    const { client, rpc } = fixture(0n);
    expect((await readJobPage(client, target)).jobs).toEqual([]);
    expect(rpc.multicall).toHaveBeenCalledTimes(1);
  });
  it('fetches one job directly with its actual URIs and same-block platform state', async () => {
    const id = 9007199254740993n;
    const { client, rpc } = fixture(id + 1n);
    const result = await readJob(client, target, String(id));
    expect(result.job).toMatchObject({ id, specUri: 'ipfs://spec', completionUri: 'https://example.com/delivery', deadlines: [1n, 2n, 3n, 4n, 5n] });
    expect(rpc.multicall.mock.calls.map(([c]) => c.contracts.length)).toEqual([10, 5]);
    for (const c of rpc.multicall.mock.calls[1][0].contracts) expect(c).toMatchObject({ args: [id] });
  });
  it('returns an explicit missing job without querying a nonexistent core', async () => {
    const { client, rpc } = fixture(3n);
    expect((await readJob(client, target, '3')).job).toBeNull();
    expect(rpc.multicall).toHaveBeenCalledTimes(1);
  });
  it.each(['-1', '1.5', '01', '1e9', '', ' 1', String(1n << 256n)])('rejects invalid ID %s before RPC use', value => {
    const { client, rpc } = fixture();
    expect(() => readJob(client, target, value)).toThrow();
    expect(rpc.getChainId).not.toHaveBeenCalled();
  });
  it('supports both endpoints of the uint256 ID range', () => {
    expect(parseJobId('0')).toBe(0n);
    expect(parseJobId(String((1n << 256n) - 1n))).toBe((1n << 256n) - 1n);
  });
  it.each(['getJobCore', 'getJobValidation', 'getJobDeadlines'])('rejects missing %s instead of deriving a false status', async name => {
    const { client, results } = fixture();
    results[name] = undefined;
    await expect(readJobPage(client, target)).rejects.toThrow('incomplete');
  });
  it('rejects malformed booleans, truncated batches and read failures', async () => {
    const { client, results, rpc } = fixture();
    results.getJobValidation = [0n, 0n, 0n, 0n, 0n];
    await expect(readJobPage(client, target)).rejects.toThrow('incomplete');
    rpc.multicall.mockResolvedValueOnce([]);
    await expect(readPlatform(client, target)).rejects.toThrow('incomplete');
    rpc.multicall.mockRejectedValueOnce(new Error('provider unavailable'));
    await expect(readJobPage(client, target)).rejects.toThrow('provider unavailable');
  });
  it('rejects wrong networks, changed networks, and reorgs', async () => {
    const { client, rpc } = fixture();
    rpc.getChainId.mockResolvedValueOnce(11155111);
    await expect(readJobPage(client, target)).rejects.toThrow('differs');
    rpc.getChainId.mockResolvedValueOnce(1).mockResolvedValueOnce(11155111);
    await expect(readJobPage(client, target)).rejects.toThrow('changed');
    rpc.getBlock.mockResolvedValueOnce({ number: 50n, hash }).mockResolvedValueOnce({ number: 50n, hash: `0x${'cd'.repeat(32)}` });
    await expect(readJobPage(client, target)).rejects.toThrow('chain changed');
  });
  it('rejects missing deployment, unsupported chain, and unmined block', async () => {
    const { client, rpc } = fixture();
    await expect(readJobPage(client, { ...target, address: zero })).rejects.toThrow('verified manager');
    await expect(readJobPage(client, { ...target, chainId: 5 })).rejects.toThrow('supported');
    rpc.getBlock.mockResolvedValueOnce({ number: null, hash: null });
    await expect(readJobPage(client, target)).rejects.toThrow('mined block');
  });
});

// Exercise viem's real transport path: all multicall chunks must keep the hash.
describe('canonical hash transport', () => {
  it('sends EIP-1898 for state reads, including across multicall chunks', async () => {
    const { results } = fixture(51n);
    const references: unknown[] = [];
    const client = createPublicClient({ chain: mainnet, transport: custom({
      async request({ method, params }: any) {
        if (method === 'eth_chainId') return '0x1';
        if (method === 'eth_getBlockByNumber') return { number: '0x32', hash, transactions: [] };
        if (method !== 'eth_call') throw new Error(`Unexpected method ${method}`);
        references.push(params[1]);
        if (params[1]?.blockHash !== hash || params[1]?.requireCanonical !== true) throw new Error('Numeric or latest state is forbidden');
        const batch = decodeFunctionData({ abi: multicall3Abi, data: params[0].data });
        const values = (batch.args![0] as any[]).map(call => {
          const name = decodeFunctionData({ abi: agiJobManagerAbi as Abi, data: call.callData }).functionName;
          return { success: true, returnData: encodeFunctionResult({ abi: agiJobManagerAbi as Abi, functionName: name, result: results[name] }) };
        });
        return encodeFunctionResult({ abi: multicall3Abi, functionName: 'aggregate3', result: values });
      }
    }, { retryCount: 0 }) });
    expect((await readJobPage(client, target)).jobs).toHaveLength(50);
    expect(references.length).toBeGreaterThan(2);
    expect(references.every(ref => JSON.stringify(ref) === JSON.stringify({ blockHash: hash, requireCanonical: true }))).toBe(true);
  });
  it('propagates unsupported canonical reads instead of retrying by number', async () => {
    const { client, rpc } = fixture();
    rpc.multicall.mockRejectedValue(new Error('EIP-1898 unsupported'));
    await expect(readJobPage(client, target)).rejects.toThrow('EIP-1898 unsupported');
    expect(rpc.multicall).toHaveBeenCalledTimes(1);
  });
});
