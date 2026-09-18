const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const html = fs.readFileSync(path.join(__dirname, '../ui/agijobmanager-usdc.html'), 'utf8');
const start = html.indexOf('async function verifyUSDCDeployment(');
const end = html.indexOf('async function refreshAll(', start);
const managerA = '0x1111111111111111111111111111111111111111';
const managerB = '0x2222222222222222222222222222222222222222';
const wallet30 = '0x3333333333333333333333333333333333333333';
const wallet10 = '0x4444444444444444444444444444444444444444';
const usdc = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48';
const zero = '0x' + '0'.repeat(40);
function deferred() {
  let resolve, reject;
  const promise = new Promise((a, b) => { resolve = a; reject = b; });
  return { promise, resolve, reject };
}
function harness() {
  const records = { [managerA]: {}, [managerB]: {} }, elements = new Map(), gates = [], toasts = [];
  const defaults = { usdcToken: usdc, settlementPausedSeconds: '0', pendingOwner: zero, wallet30, wallet10 };
  const contracts = Object.fromEntries(Object.keys(records).map(address => [address, {
    options: { address }, methods: Object.fromEntries(Object.keys(defaults).map(name => [name, () => ({ call: async () => {
      const result = records[address][name];
      return typeof result === 'function' ? result() : result === undefined ? defaults[name] : result;
    } })]))
  }]));
  const provider = { request: async () => [wallet30] };
  const tokenInstances = [];
  let context, refreshes = 0;
  const web3 = {
    currentProvider: provider, utils: { isAddress: address => /^0x[\da-f]{40}$/i.test(address) },
    eth: { getChainId: async () => 1, getAccounts: async () => [wallet30], getCode: async () => '0x6000', Contract: function(_abi, address) {
      if (address === usdc) {
        const token = { options: { address }, methods: { decimals: () => ({ call: async () => 6 }) } };
        tokenInstances.push(token); return token;
      }
      return contracts[address];
    } }
  };
  const element = id => {
    if (!elements.has(id)) elements.set(id, { textContent: '', disabled: true });
    return elements.get(id);
  };
  context = vm.createContext({
    web3, window: { ethereum: provider }, Web3: function() { return web3; },
    AGI_JOB_MANAGER: managerA, AGIJobManagerABI: [], ERC20ABI: [], USDC_ADDRESS: usdc,
    agiJobManager: contracts[managerA], usdcToken: { stale: true }, tokenDecimals: 18,
    userAccount: wallet30, isMainnet: true, APP_STATE: { writeEpoch: 0, wallet: {} }, usdcDeploymentValidated: true,
    el: element, updateWriteGate: () => gates.push(context.usdcDeploymentValidated), clearToast: () => {},
    setToast: message => toasts.push(message), shortAddr: String, clearEnsPreview: () => {},
    refreshAll: async () => { refreshes++; }, console: { error() {} }
  });
  vm.runInContext(html.slice(start, end), context);
  const changeManager = address => {
    context.APP_STATE.writeEpoch++; context.AGI_JOB_MANAGER = address;
    context.agiJobManager = null; context.usdcToken = null; context.usdcDeploymentValidated = false;
  };
  const hold = (address = managerA) => {
    const started = deferred(), result = deferred();
    records[address].wallet10 = () => { started.resolve(); return result.promise; };
    return { started: started.promise, resolve: () => result.resolve(wallet10), reject: () => result.reject(new Error('Old RPC failure')) };
  };
  return { context, records, element, gates, toasts, contracts, tokenInstances, changeManager, hold, refreshes: () => refreshes };
}
const isStale = error => error.code === 'STALE_DEPLOYMENT_CHECK';

describe('USDC deployment verification context', () => {
  it('disables writes immediately while checking, then commits the verified current manager', async () => {
    const h = harness(), held = h.hold(), pending = h.context.verifyUSDCDeployment();
    assert.equal(h.context.usdcDeploymentValidated, false);
    assert.deepEqual(h.gates, [false]);
    await held.started; held.resolve(); await pending;
    assert.equal(h.context.usdcDeploymentValidated, true);
    assert.equal(h.context.agiJobManager, h.contracts[managerA]);
    assert.equal(h.context.tokenDecimals, 6);
    assert.match(h.element('usdcDeploymentStatus').textContent, new RegExp(managerA));
    assert.deepEqual(h.gates, [false, true]);
  });

  it('does not let a late success from A bless a rejected manager B', async () => {
    const h = harness(), held = h.hold(), pending = h.context.verifyUSDCDeployment();
    await held.started; h.changeManager(managerB); h.records[managerB].usdcToken = managerB;
    await assert.rejects(h.context.verifyUSDCDeployment(), /not native Circle USDC/);
    const status = h.element('usdcDeploymentStatus').textContent, gateCount = h.gates.length;
    held.resolve(); await assert.rejects(pending, isStale);
    assert.equal(h.context.usdcDeploymentValidated, false);
    assert.equal(h.context.usdcToken, null);
    assert.equal(h.context.agiJobManager, null);
    assert.equal(h.element('usdcDeploymentStatus').textContent, status);
    assert.equal(h.gates.length, gateCount);
  });

  it('does not let an old RPC failure revoke a successfully verified manager B', async () => {
    const h = harness(), held = h.hold(), pending = h.context.verifyUSDCDeployment();
    await held.started; h.changeManager(managerB); await h.context.verifyUSDCDeployment();
    const status = h.element('usdcDeploymentStatus').textContent, token = h.context.usdcToken, gateCount = h.gates.length;
    held.reject(); await assert.rejects(pending, isStale);
    assert.equal(h.context.usdcDeploymentValidated, true);
    assert.equal(h.context.usdcToken, token);
    assert.equal(h.context.agiJobManager, h.contracts[managerB]);
    assert.equal(h.element('usdcDeploymentStatus').textContent, status);
    assert.equal(h.gates.length, gateCount);
  });

  it('rejects a same-address check after account or chain reset without touching replacement state', async () => {
    const h = harness(), held = h.hold(), pending = h.context.verifyUSDCDeployment();
    await held.started; h.changeManager(managerA);
    const gateCount = h.gates.length;
    held.resolve(); await assert.rejects(pending, isStale);
    assert.equal(h.context.usdcDeploymentValidated, false);
    assert.equal(h.context.usdcToken, null);
    assert.equal(h.gates.length, gateCount);
  });

  it('rejects a provider replacement even if the address and write epoch remain unchanged', async () => {
    const h = harness(), held = h.hold(), pending = h.context.verifyUSDCDeployment();
    await held.started; h.context.web3.currentProvider = { request: async () => [] };
    held.resolve(); await assert.rejects(pending, isStale);
    assert.equal(h.context.usdcDeploymentValidated, false);
    assert.equal(h.gates.length, 1);
  });

  it('rebuilds a same-address manager with the checked provider instead of trusting an old contract instance', async () => {
    const h = harness();
    h.context.web3.currentProvider = { request: async () => [wallet30] };
    h.context.agiJobManager = { options: { address: managerA }, methods: { usdcToken: () => ({ call: async () => { throw new Error('Stale-provider contract was read'); } }) } };
    await h.context.verifyUSDCDeployment();
    assert.equal(h.context.usdcDeploymentValidated, true);
    assert.equal(h.context.agiJobManager, h.contracts[managerA]);
  });

  it('lets the latest verification win when two checks overlap in the same context', async () => {
    const h = harness(), held = h.hold(), pending = h.context.verifyUSDCDeployment();
    await held.started; delete h.records[managerA].wallet10; await h.context.verifyUSDCDeployment();
    const token = h.context.usdcToken, gateCount = h.gates.length;
    held.reject(); await assert.rejects(pending, isStale);
    assert.equal(h.context.usdcDeploymentValidated, true);
    assert.equal(h.context.usdcToken, token);
    assert.equal(h.gates.length, gateCount);
  });

  it('stops an obsolete connection attempt without refreshing or replacing the current toast', async () => {
    const h = harness(), held = h.hold(), pending = h.context.connectWallet();
    await held.started; h.changeManager(managerB); await h.context.verifyUSDCDeployment();
    const status = h.element('usdcDeploymentStatus').textContent, toastCount = h.toasts.length;
    held.resolve(); await pending;
    assert.equal(h.refreshes(), 0);
    assert.equal(h.toasts.length, toastCount);
    assert.equal(h.element('usdcDeploymentStatus').textContent, status);
  });
});
