const assert = require('node:assert/strict');
const { buildInitConfig } = require('./helpers/deploy');

contract('Read-only settlement status', accounts => {
  const [owner, buyer, agent, outsider, wallet30, wallet10] = accounts;
  let api, provider, manager, token, options;
  const rpc = (method, params = []) => web3.currentProvider.request({ method, params });
  const advance = async seconds => { await rpc('evm_increaseTime', [seconds]); await rpc('evm_mine'); };
  const read = async (overrides = {}) => api.collectSnapshot(provider, { ...options, ...overrides }, Number(BigInt(await rpc('eth_blockNumber'))));
  before(async () => {
    api = await import('../scripts/ops/settlement-status.mjs');
    const { BrowserProvider } = await import('ethers');
    provider = new BrowserProvider(web3.currentProvider, undefined, { cacheTimeout: -1 });
  });
  after(() => provider?.destroy());
  beforeEach(async () => {
    token = await artifacts.require('MockUSDCControls').new();
    const ens = await artifacts.require('MockENSRegistry').new();
    const wrapper = await artifacts.require('MockNameWrapper').new();
    const zero = '0x' + '00'.repeat(32);
    manager = await artifacts.require('AGIJobManager').new(...buildInitConfig(token.address, 'ipfs://', ens.address, wrapper.address, zero, zero, zero, zero, zero, zero, [wallet30, wallet10]));
    await manager.addAdditionalAgent(agent);
    await manager.setCompletionReviewPeriod(100);
    for (const who of [buyer, agent]) {
      await token.mint(who, '1000000000'); await token.approve(manager.address, '1000000000', { from: who });
    }
    await manager.unpauseIntake();
    options = { managerAddress: manager.address, chainId: String(BigInt(await rpc('eth_chainId'))), jobIds: [], beneficiaries: [] };
  });
  const create = () => manager.createJob('ipfs://criteria', '100000000', 3600, 'Acceptance criteria', { from: buyer });
  const assign = () => manager.applyForJob(0, '', [], { from: agent });
  const submit = () => manager.requestJobCompletion(0, 'ipfs://result', { from: agent });

  it('separates closed jobs, selected claims and unpaid aggregate obligations, then observes recovery', async () => {
    await create(); await assign(); await submit();
    await token.setBlocked(wallet30, true); await token.setBlocked(wallet10, true);
    await manager.acceptJob(0, { from: buyer });
    const before = await rpc('eth_blockNumber');
    const snapshot = await read({ jobIds: ['0'], beneficiaries: [wallet30, wallet30] });
    assert.equal(await rpc('eth_blockNumber'), before, 'reading must not mine or send a transaction');
    assert.equal(snapshot.jobs[0].completed, true);
    assert.equal(snapshot.reserves.lockedClaims, '40000000');
    assert.equal(snapshot.assessment.selectedClaims, '30000000');
    assert.equal(snapshot.assessment.claimsOutsideSelection, '10000000');
    assert.equal(snapshot.assessment.noReservedLiabilitiesAtBlock, false);
    assert.deepEqual(snapshot.assessment.attention, ['UNPAID_CLAIMS']);
    for (const who of [wallet30, wallet10]) { await token.setBlocked(who, false); await manager.claimUSDC(who, { from: outsider }); }
    const resolved = await read({ jobIds: ['0'], beneficiaries: [wallet30, wallet10] });
    assert.equal(resolved.assessment.noReservedLiabilitiesAtBlock, true);
    assert.equal(resolved.managerBalance, '0');
    assert.deepEqual(resolved.assessment.attention, []);
  });
  it('reads pause-adjusted deadlines from the contract and flags stopped settlement with obligations', async () => {
    await create(); await assign(); await submit();
    const first = await read({ jobIds: ['0'] });
    await manager.setSettlementPaused(true); await advance(300);
    const paused = await read({ jobIds: ['0'] });
    assert.equal(paused.settlementPaused, true);
    assert(BigInt(paused.jobs[0].deadlines.reviewEnd) >= BigInt(first.jobs[0].deadlines.reviewEnd) + 300n);
    assert(paused.assessment.attention.includes('SETTLEMENT_PAUSED_WITH_OBLIGATIONS'));
    assert.equal(paused.assessment.noReservedLiabilitiesAtBlock, false);
  });
  it('keeps unreserved donations separate from liabilities and detects a synthetic deficit', async () => {
    await token.mint(manager.address, '1234567');
    const snapshot = await read();
    assert.equal(snapshot.assessment.totalReserved, '0');
    assert.equal(snapshot.assessment.balanceMinusReserves, '1234567');
    assert.equal(api.usdc('9007199254740993123456'), '9007199254740993.123456');
    await create(); const active = await read();
    active.managerBalance = '1';
    assert(api.assess(active).attention.includes('RESERVE_DEFICIT'));
    active.beneficiaries = [{ pendingUSDC: '1' }];
    assert.throws(() => api.assess(active), /exceed/);
  });
  it('rejects wrong chains, missing code, missing and cancelled jobs', async () => {
    await assert.rejects(read({ chainId: '1' }), /chain ID/);
    await assert.rejects(read({ managerAddress: outsider }), /No manager code/);
    await assert.rejects(read({ jobIds: ['99'] }));
    await create(); await manager.cancelJob(0, { from: buyer });
    await assert.rejects(read({ jobIds: ['0'] }));
  });
  it('rejects block-hash changes and disagreeing RPC observations', async () => {
    let blocks = 0;
    const changing = new Proxy(provider, { get(target, key) {
      if (key === 'send') return async (method, params) => {
        const value = await target.send(method, params);
        if (method === 'eth_getBlockByNumber' && ++blocks === 2) return { ...value, hash: '0x' + '11'.repeat(32) };
        return value;
      };
      const value = Reflect.get(target, key); return typeof value === 'function' ? value.bind(target) : value;
    } });
    await assert.rejects(api.collectSnapshot(changing, options, Number(BigInt(await rpc('eth_blockNumber')))), /Block hash changed/);
    const snapshot = await read();
    api.compareSnapshots(snapshot, structuredClone(snapshot));
    const changed = structuredClone(snapshot); changed.managerBalance = '1';
    assert.throws(() => api.compareSnapshots(snapshot, changed), /disagree/);
  });
  it('bounds selections, rejects ambiguous arguments and keeps exact integer amounts', () => {
    const args = ['--manager', manager.address, '--chain-id', options.chainId];
    assert.equal(api.parseArgs(args).confirmations, 12);
    for (const extra of [['--private-key', 'secret'], ['--jobs', '-1'], ['--jobs', '1e3'], ['--jobs', '01'], ['--json', '--json'], ['--confirmations', '0.5'], ['--jobs', Array(51).fill('0').join(',')]]) {
      assert.throws(() => api.parseArgs([...args, ...extra]));
    }
    assert.throws(() => api.normalizeOptions({ ...options, beneficiaries: Array(101).fill(buyer) }));
    assert.equal(api.usdc('-1'), '-0.000001');
    assert.equal(api.usdc('1000000'), '1.000000');
  });
  it('runs the actual CLI over read-only JSON-RPC with exit codes, historical reads and redacted failures', async function () {
    this.timeout(30000);
    const { createServer } = require('node:http');
    const { execFile } = require('node:child_process');
    const path = require('node:path');
    let fail = false;
    const seen = new Set();
    const server = createServer(async (req, res) => {
      let body = ''; for await (const chunk of req) body += chunk;
      const input = JSON.parse(body); seen.add(input.method);
      const response = { jsonrpc: '2.0', id: input.id };
      try {
        if (fail) throw Error('https://rpc.invalid/PRIVATE_RPC_SECRET');
        response.result = await rpc(input.method, input.params);
      } catch (error) { response.error = { code: -32000, message: error.message }; }
      res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(response));
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const endpoint = `http://127.0.0.1:${server.address().port}/PRIVATE_RPC_SECRET`;
    const run = (extra = []) => new Promise(resolve => execFile(process.execPath,
      [path.resolve('scripts/ops/settlement-status.mjs'), '--manager', manager.address, '--chain-id', options.chainId, '--confirmations', '0', '--json', ...extra],
      { env: { PATH: process.env.PATH, SETTLEMENT_RPC_URL: endpoint }, timeout: 20000 },
      (error, stdout, stderr) => resolve({ code: error?.code ?? 0, stdout, stderr })));
    try {
      const empty = await run(); assert.equal(empty.code, 0, empty.stderr);
      assert.equal(JSON.parse(empty.stdout).assessment.noReservedLiabilitiesAtBlock, true);
      const oldBlock = Number(BigInt(await rpc('eth_blockNumber')));
      await create(); await token.setBlocked(buyer, true); await manager.cancelJob(0, { from: buyer });
      const outstanding = await run(); assert.equal(outstanding.code, 2, outstanding.stderr);
      assert.equal(JSON.parse(outstanding.stdout).reserves.lockedClaims, '100000000');
      const past = await api.collectSnapshot(provider, options, oldBlock);
      assert.equal(past.reserves.lockedClaims, '0'); assert.equal(past.assessment.totalReserved, '0');
      fail = true; const failed = await run(); assert.equal(failed.code, 1);
      assert.equal(failed.stdout, ''); assert(!failed.stderr.includes('PRIVATE_RPC_SECRET'));
      assert([...seen].every(method => ['eth_chainId', 'eth_blockNumber', 'eth_getBlockByNumber', 'eth_getCode', 'eth_call'].includes(method)));
    } finally { await new Promise(resolve => server.close(resolve)); }
  });
});
