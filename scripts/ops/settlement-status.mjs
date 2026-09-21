#!/usr/bin/env node
// Read-only, bounded snapshots. No signer, key loading, log scanning or transactions.
import { Contract, FetchRequest, JsonRpcProvider, ZeroAddress, getAddress, toQuantity } from 'ethers';
import { pathToFileURL } from 'node:url';

export const RESERVES = ['lockedEscrow', 'lockedAgentBonds', 'lockedValidatorBonds', 'lockedDisputeBonds', 'lockedClaims'];
const ABI = [
  ...RESERVES.map(name => `function ${name}() view returns (uint256)`),
  'function usdcToken() view returns (address)',
  'function settlementPaused() view returns (bool)',
  'function paused() view returns (bool)',
  'function pendingUSDC(address) view returns (uint256)',
  'function getJobCore(uint256) view returns (address employer,address assignedAgent,uint256 payout,uint256 duration,uint256 assignedAt,bool completed,bool disputed,bool expired,uint8 agentPayoutPct)',
  'function getJobValidation(uint256) view returns (bool completionRequested,uint256 validatorApprovals,uint256 validatorDisapprovals,uint256 completionRequestedAt,uint256 disputedAt)',
  'function getJobDeadlines(uint256) view returns (uint256 assignmentDeadline,uint256 reviewEnd,uint256 settlementAfter,uint256 ownerResolutionAfter,uint256 neutralRefundAfter)',
];
const TOKEN_ABI = ['function balanceOf(address) view returns (uint256)', 'function decimals() view returns (uint8)'];
export class StatusError extends Error {}
const requireStatus = (condition, message) => { if (!condition) throw new StatusError(message); };
const uint = value => /^(0|[1-9][0-9]*)$/.test(String(value)) && BigInt(value) < 2n ** 256n;
const address = value => {
  try { const result = getAddress(value); if (result !== ZeroAddress) return result; } catch { /* generic error below */ }
  throw new StatusError('Use a nonzero, valid Ethereum address (with a valid checksum if mixed case).');
};
export function normalizeOptions(options) {
  requireStatus(uint(options.chainId) && BigInt(options.chainId) > 0n, 'An explicit positive chain ID is required.');
  const jobIds = options.jobIds ?? [], beneficiaries = options.beneficiaries ?? [];
  requireStatus(Array.isArray(jobIds) && jobIds.length <= 50 && jobIds.every(uint), 'Select at most 50 unsigned integer job IDs.');
  requireStatus(Array.isArray(beneficiaries) && beneficiaries.length <= 100, 'Select at most 100 beneficiary addresses.');
  return { managerAddress: address(options.managerAddress), chainId: String(options.chainId),
    jobIds: [...new Set(jobIds.map(String))].sort((a, b) => BigInt(a) < BigInt(b) ? -1 : 1),
    beneficiaries: [...new Set(beneficiaries.map(address))].sort() };
}
export function usdc(value) {
  const amount = BigInt(value), negative = amount < 0n, magnitude = negative ? -amount : amount;
  return `${negative ? '-' : ''}${magnitude / 1000000n}.${String(magnitude % 1000000n).padStart(6, '0')}`;
}
export function assess(snapshot) {
  const total = RESERVES.reduce((sum, key) => sum + BigInt(snapshot.reserves[key]), 0n);
  const balance = BigInt(snapshot.managerBalance), claims = BigInt(snapshot.reserves.lockedClaims);
  const selected = snapshot.beneficiaries.reduce((sum, item) => sum + BigInt(item.pendingUSDC), 0n);
  requireStatus(selected <= claims, 'Selected claims exceed the aggregate reserve; the snapshot is inconsistent.');
  const attention = [];
  if (balance < total) attention.push('RESERVE_DEFICIT');
  if (claims > 0n) attention.push('UNPAID_CLAIMS');
  if (snapshot.settlementPaused && total > 0n) attention.push('SETTLEMENT_PAUSED_WITH_OBLIGATIONS');
  return { totalReserved: total.toString(), balanceMinusReserves: (balance - total).toString(),
    selectedClaims: selected.toString(), claimsOutsideSelection: (claims - selected).toString(),
    noReservedLiabilitiesAtBlock: total === 0n, attention,
    meaning: 'Reserve counters at one block only; not proof of work quality, profit, future recovery or complete job history.' };
}

export async function collectSnapshot(provider, options, blockNumber) {
  const selected = normalizeOptions(options);
  requireStatus(Number.isSafeInteger(blockNumber) && blockNumber >= 0, 'Use a nonnegative safe integer block number.');
  // Direct reads bypass provider block caches so the final hash check can detect a reorg.
  const chain = await provider.send('eth_chainId', []);
  requireStatus(BigInt(chain) === BigInt(selected.chainId), 'RPC chain ID differs from the expected chain.');
  const blockTag = toQuantity(blockNumber);
  const block = await provider.send('eth_getBlockByNumber', [blockTag, false]);
  requireStatus(block?.hash && Number(BigInt(block.number)) === blockNumber, 'Selected block is unavailable.');
  requireStatus(await provider.getCode(selected.managerAddress, blockNumber) !== '0x', 'No manager code at the selected block.');
  const manager = new Contract(selected.managerAddress, ABI, provider), at = { blockTag: blockNumber };
  const tokenAddress = address(await manager.usdcToken(at));
  requireStatus(await provider.getCode(tokenAddress, blockNumber) !== '0x', 'No token code at the selected block.');
  const token = new Contract(tokenAddress, TOKEN_ABI, provider);
  requireStatus(await token.decimals(at) === 6n, 'This report requires a six-decimal settlement token.');
  const reserves = {};
  for (const key of RESERVES) reserves[key] = String(await manager[key](at));
  const snapshot = { schema: 'agijobmanager-settlement-status/v1', readOnly: true,
    chainId: selected.chainId, managerAddress: selected.managerAddress, tokenAddress,
    block: { number: blockNumber, hash: block.hash, timestamp: String(BigInt(block.timestamp)) },
    managerBalance: String(await token.balanceOf(selected.managerAddress, at)), reserves,
    intakePaused: await manager.paused(at), settlementPaused: await manager.settlementPaused(at),
    beneficiaries: [], jobs: [], jobCoverage: 'explicit selection only; no claim of complete history',
    deploymentVerification: 'not performed; verify manager, linked libraries and token independently' };
  for (const beneficiary of selected.beneficiaries) {
    snapshot.beneficiaries.push({ address: beneficiary, pendingUSDC: String(await manager.pendingUSDC(beneficiary, at)) });
  }
  for (const jobId of selected.jobIds) {
    // Missing or cancelled IDs deliberately fail the whole read; never silently label them paid.
    const core = await manager.getJobCore(jobId, at), validation = await manager.getJobValidation(jobId, at);
    const deadlines = await manager.getJobDeadlines(jobId, at);
    const names = ['assignmentDeadline', 'reviewEnd', 'settlementAfter', 'ownerResolutionAfter', 'neutralRefundAfter'];
    snapshot.jobs.push({ jobId, employer: core.employer, assignedAgent: core.assignedAgent,
      payout: String(core.payout), completed: core.completed, expired: core.expired, disputed: core.disputed,
      completionRequested: validation.completionRequested,
      deadlines: Object.fromEntries(names.map((name, i) => [name, String(deadlines[i])])),
      deadlineMeaning: 'contract-reported wall-clock deadlines; settlement pause stops lifecycle clocks; eligibility still requires simulation' });
  }
  const end = await provider.send('eth_getBlockByNumber', [blockTag, false]);
  requireStatus(end?.hash === block.hash, 'Block hash changed during the read; discard the snapshot and retry.');
  requireStatus(BigInt(await provider.send('eth_chainId', [])) === BigInt(selected.chainId), 'RPC chain changed during the read.');
  snapshot.assessment = assess(snapshot);
  return snapshot;
}

export function compareSnapshots(primary, secondary) {
  requireStatus(JSON.stringify(primary) === JSON.stringify(secondary), 'RPC snapshots disagree; discard the report and investigate.');
}
export function parseArgs(argv) {
  const values = {}, allowed = new Set(['manager', 'chain-id', 'jobs', 'beneficiaries', 'confirmations']);
  for (let i = 0; i < argv.length; i++) {
    const key = argv[i].replace(/^--/, '');
    requireStatus(argv[i].startsWith('--') && (allowed.has(key) || ['json', 'help'].includes(key)) && !(key in values), 'Unknown, duplicate or malformed option. Run with --help.');
    if (['json', 'help'].includes(key)) values[key] = true;
    else { requireStatus(i + 1 < argv.length && !argv[i + 1].startsWith('--'), 'Option value missing.'); values[key] = argv[++i]; }
  }
  if (values.help) return { help: true };
  const confirmations = values.confirmations ?? '12';
  requireStatus(uint(confirmations) && BigInt(confirmations) <= 100000n, 'Confirmations must be an integer from 0 through 100000.');
  return { ...normalizeOptions({ managerAddress: values.manager, chainId: values['chain-id'],
    jobIds: values.jobs === undefined ? [] : values.jobs.split(','),
    beneficiaries: values.beneficiaries === undefined ? [] : values.beneficiaries.split(',') }),
    confirmations: Number(confirmations), json: values.json === true };
}
function makeProvider(url, chainId) {
  let parsed;
  try { parsed = new URL(url); } catch { throw new StatusError('Set SETTLEMENT_RPC_URL to an HTTP(S) endpoint.'); }
  requireStatus(['https:', 'http:'].includes(parsed.protocol), 'RPC endpoints must use HTTP(S).');
  requireStatus(parsed.protocol === 'https:' || ['localhost', '127.0.0.1', '[::1]'].includes(parsed.hostname), 'Use HTTPS for remote RPC endpoints.');
  const request = new FetchRequest(url); request.timeout = 15000;
  // Chain identity is checked explicitly with uncached eth_chainId before and
  // after each snapshot. Suppress ethers' autonomous bootstrap retry/log loop;
  // it otherwise contaminates stdout when a JSON report fails to initialize.
  return new JsonRpcProvider(request, BigInt(chainId), { staticNetwork: true, cacheTimeout: -1, batchMaxCount: 1 });
}
export function renderReport(report) {
  const a = report.assessment;
  return [
    `AGIJobManager settlement status — read only`,
    `Chain ${report.chainId}; manager ${report.managerAddress}`,
    `Block ${report.block.number} (${report.block.hash}); ${report.confirmations} blocks behind primary head`,
    `RPC agreement: ${report.rpcAgreement}`,
    ...RESERVES.map(key => `${key}: ${usdc(report.reserves[key])} USDC`),
    `Total reserved: ${usdc(a.totalReserved)} USDC`,
    `Manager balance: ${usdc(report.managerBalance)} USDC`,
    `Balance minus reserves: ${usdc(a.balanceMinusReserves)} USDC`,
    `Claims outside selected beneficiaries: ${usdc(a.claimsOutsideSelection)} USDC`,
    `Intake paused: ${report.intakePaused}; settlement paused: ${report.settlementPaused}`,
    `Attention: ${a.attention.join(', ') || 'none from aggregate checks'}`,
    `Selected jobs: ${report.jobs.length}; selected beneficiaries: ${report.beneficiaries.length}. Use --json for details.`,
    a.meaning, report.deploymentVerification,
  ].join('\n');
}
export async function main(argv = process.argv.slice(2), env = process.env) {
  const options = parseArgs(argv);
  if (options.help) {
    console.log('Usage: npm run settlement:status -- --manager 0xADDRESS --chain-id 1 [--jobs 0,1] [--beneficiaries 0xADDRESS] [--confirmations 12] [--json]\nSet SETTLEMENT_RPC_URL; optional SETTLEMENT_VERIFY_RPC_URL compares the same block through another RPC. No key or wallet is used. See docs/OPERATIONS/SETTLEMENT_RECOVERY.md.');
    return 0;
  }
  const providers = [];
  try {
    const primary = makeProvider(env.SETTLEMENT_RPC_URL, options.chainId); providers.push(primary);
    const head = Number(BigInt(await primary.send('eth_blockNumber', [])));
    requireStatus(Number.isSafeInteger(head) && head >= options.confirmations, 'RPC head is below the requested confirmation depth.');
    const report = await collectSnapshot(primary, options, head - options.confirmations);
    let agreement = 'single RPC; not independently corroborated';
    if (env.SETTLEMENT_VERIFY_RPC_URL) {
      requireStatus(env.SETTLEMENT_VERIFY_RPC_URL !== env.SETTLEMENT_RPC_URL, 'Verification RPC must differ from the primary endpoint.');
      const secondary = makeProvider(env.SETTLEMENT_VERIFY_RPC_URL, options.chainId); providers.push(secondary);
      compareSnapshots(report, await collectSnapshot(secondary, options, report.block.number));
      agreement = 'two configured endpoints agree; endpoint independence is the operator responsibility';
    }
    report.confirmations = options.confirmations; report.rpcAgreement = agreement;
    console.log(options.json ? JSON.stringify(report, null, 2) : renderReport(report));
    return report.assessment.attention.length ? 2 : 0;
  } finally { for (const provider of providers) provider.destroy(); }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const timeout = setTimeout(() => { console.error('Settlement status timed out; no complete report was produced.'); process.exit(1); }, 120000);
  try { process.exitCode = await main(); }
  catch (error) {
    // Provider errors may embed URLs, credentials and RPC response bodies. Do not print them.
    console.error(error instanceof StatusError ? error.message : 'Snapshot failed. Check endpoint availability, historical-state support, deployment ABI and selected IDs. No complete report was produced.');
    process.exitCode = 1;
  } finally { clearTimeout(timeout); }
}
