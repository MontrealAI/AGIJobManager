import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

// Exercise the actual frozen functions, without wallet access or transactions.
const root = path.resolve(process.argv[2] || '.');
const filename = 'ui/agijobmanager-usdc.html';
const html = fs.readFileSync(path.join(root, filename), 'utf8');
let checks = 0;
function check(name, fn) { fn(); checks++; console.log(`PASS ${name}`); }
function section(start, end) {
  const a = html.indexOf(start), b = html.indexOf(end, a + start.length);
  assert.ok(a >= 0 && b > a, `Missing function boundary: ${start}`);
  return html.slice(a, b);
}
check('all USDC inline scripts parse', () => {
  const inline = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)]
    .filter((m) => !/\bsrc\s*=/.test(m[1]));
  assert.equal(inline.length, 4);
  inline.forEach((m, i) => new vm.Script(m[2], { filename: `${filename}#${i}` }));
});
check('USDC-only console has no default legacy manager or bridge execution', () => {
  assert.match(html, /let AGI_JOB_MANAGER = ''/);
  assert.match(html, /const USDC_ADDRESS = ['"]0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48['"]/ );
  assert.ok(!html.includes('updateUSDCTokenAddress'));
  assert.ok(!html.includes('OFFICIAL_USDC_ETH'));
});
const amounts = vm.createContext({tokenDecimals:6});
vm.runInContext(section('function parseAmountToUnits(', 'function secondsToHuman('), amounts);
for (const value of ['0.000001','123.456789','9007199254740993.123456']) {
  check(`USDC exact amount ${value}`, () => assert.equal(amounts.formatUnitsToAmount(amounts.parseAmountToUnits(value)),value));
}
for (const value of ['0.0000001','1.2345678','1e6','-1', (2n**256n).toString()]) {
  check(`USDC rejects invalid amount ${value}`, () => assert.throws(() => amounts.parseAmountToUnits(value)));
}
const canonical = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48';
const manager = '0x1111111111111111111111111111111111111111';
for (const [label,chain,token,decimals,code,pass] of [
  ['valid USDC',1,canonical,6,'0x6000',true],
  ['wrong chain',11155111,canonical,6,'0x6000',false],
  ['wrong token',1,manager,6,'0x6000',false],
  ['wrong decimals',1,canonical,18,'0x6000',false],
  ['missing code',1,canonical,6,'0x',false]
]) {
  let gateCalls = 0;
  const ctx = vm.createContext({
    USDC_ADDRESS:canonical, AGI_JOB_MANAGER:manager, AGIJobManagerABI:[], ERC20ABI:[],
    usdcDeploymentValidated:true, usdcToken:{stale:true}, tokenDecimals:18,
    agiJobManager:{options:{address:manager},methods:{settlementPausedSeconds:()=>({call:async()=> '0'}),pendingOwner:()=>({call:async()=> '0x0000000000000000000000000000000000000000'}),usdcToken:()=>({call:async()=>token}),wallet30:()=>({call:async()=> '0x3333333333333333333333333333333333333333'}),wallet10:()=>({call:async()=> '0x4444444444444444444444444444444444444444'})}},
    web3:{utils:{isAddress:()=>true},eth:{getChainId:async()=>chain,getCode:async()=>code,
      Contract:function(){return {methods:{decimals:()=>({call:async()=>decimals})}};}}},
    el:()=>({textContent:''}),updateWriteGate:()=>{gateCalls++;}
  });
  vm.runInContext(section('async function verifyUSDCDeployment(', 'async function connectWallet('),ctx);
  if (pass) await ctx.verifyUSDCDeployment(); else await assert.rejects(ctx.verifyUSDCDeployment());
  check(`transaction preflight: ${label}`,()=>{
    assert.equal(ctx.usdcDeploymentValidated,pass);
    assert.equal(gateCalls,1);
    if(!pass) assert.equal(ctx.usdcToken,null);
  });
}
const bond = vm.createContext({ getProtocolBigInt: () => { throw Error('Test must supply protocol parameters'); } });
vm.runInContext(section('function buildAgentBondTrace(', 'function buildDisputeBondTrace('), bond);
const agentParams = {bpsRaw:500n, minBondRaw:100n, maxBondRaw:1000n, durationLimitRaw:100n};
for (const [name, payout, duration, params, expected] of [
  ['percentage plus duration', 10000n, 50n, {}, 750n],
  ['minimum then duration', 1000n, 50n, {}, 150n],
  ['maximum clamp', 100000n, 100n, {}, 1000n],
  ['payout clamp', 25n, 100n, {}, 25n],
  ['zero duration limit', 10000n, 50n, {durationLimitRaw:0n}, 500n],
  ['zero maximum is unbounded for agents', 100000n, 100n, {maxBondRaw:0n}, 10000n],
  ['integer flooring', 199n, 0n, {minBondRaw:0n, bpsRaw:50n}, 0n],
  ['zero payout', 0n, 100n, {}, 0n],
  ['large token amount', 10n**24n, 50n, {maxBondRaw:0n}, 75n*10n**21n]
]) check(`agent bond: ${name}`, () => assert.equal(bond.buildAgentBondTrace({payout,duration}, {...agentParams,...params}).finalBondRaw, expected));
for (const [name, payout, params, expected] of [
  ['percentage', 10000n, {}, 500n],
  ['minimum', 1000n, {}, 100n],
  ['maximum', 100000n, {}, 1000n],
  ['payout cap', 25n, {}, 25n],
  ['zero maximum disables validator bond', 10000n, {maxBondRaw:0n}, 0n]
]) check(`validator bond: ${name}`, () => assert.equal(bond.buildValidatorBondTrace(payout, {...agentParams,...params}).finalBondRaw, expected));
vm.runInContext(section('function assertSnapshotMatch(', 'async function fetchAgentBondSnapshot('), bond);
check('equivalent bigint and string snapshots agree', () => bond.assertSnapshotMatch('bond', {amount:25n}, {amount:'25'}, ['amount']));
check('changed snapshot blocks the reviewed action', () => assert.throws(() => bond.assertSnapshotMatch('bond', {amount:'25'}, {amount:'26'}, ['amount']), /Calculation mismatch/));
check('missing snapshot field blocks the reviewed action', () => assert.throws(() => bond.assertSnapshotMatch('bond', {amount:'25'}, {}, ['amount']), /Calculation mismatch/));

const elements = new Map();
function element(id) {
  if (!elements.has(id)) elements.set(id, {textContent:'stale',innerHTML:'stale',checked:true,style:{display:'block'},removeAttribute(name){this[name]=null;}});
  return elements.get(id);
}
let clearedReason, persisted = 0, gated = 0;
const session = vm.createContext({
  console: {info(){}},
  window: {ethereum:{request:async ({method}) => {assert.equal(method,'eth_accounts'); return [];}}},
  userAccount:'stale-account', hasAcceptedTerms:true, usdcDeploymentValidated:true, pendingReviewedAction:{},
  APP_STATE:{wallet:{account:'stale-account',termsAccepted:true},jobsReadDegraded:true,admin:{isModerator:true},registrar:{managerAuthorized:true},identity:{preview:'stale'}},
  verified:{agent:'stale',club:'stale',agentAlpha:true,clubAlpha:true},
  activeJobIndexCache:{ids:[1,2],ts:123}, jobCache:new Map([[1,{}]]), latestJobs:[{}],
  resolvedEnsJobPagesAddress:'stale-address', resolvedEnsJobPagesSource:'stale-source',
  el:element, byId:element, clearEnsPreview(reason){clearedReason=reason;},
  updateWriteGate(){gated++;}, persistAccessState(){persisted++;}
});
vm.runInContext(section('function resetRuntimeState(', 'async function getActiveJobIdsFromEvents('), session);
vm.runInContext(section('async function silentWalletRefresh(', 'function updateViewportVars('), session);
await session.silentWalletRefresh();
check('no-account recovery clears wallet, membership and accepted terms', () => {
  assert.equal(session.userAccount,null);
  assert.equal(session.APP_STATE.wallet.account,null);
  assert.equal(session.hasAcceptedTerms,false);
  assert.equal(session.APP_STATE.wallet.termsAccepted,false);
  assert.equal(session.verified.agent,null);
  assert.equal(session.verified.club,null);
  assert.equal(session.verified.agentAlpha,false);
  assert.equal(session.verified.clubAlpha,false);
  assert.equal(element('termsAccepted').checked,false);
});
check('no-account recovery invalidates cached jobs and privileged state', () => {
  assert.equal(session.jobCache.size,0);
  assert.equal(session.activeJobIndexCache.ids,null);
  assert.equal(session.activeJobIndexCache.ts,0);
  assert.equal(session.latestJobs.length,0);
  assert.equal(session.APP_STATE.admin.isModerator,false);
  assert.equal(session.APP_STATE.admin.managerOwner,null);
  assert.equal(session.APP_STATE.registrar.managerAuthorized,false);
  assert.equal(session.APP_STATE.identity.preview,null);
  assert.equal(session.resolvedEnsJobPagesAddress,'');
  assert.equal(session.resolvedEnsJobPagesSource,'unavailable');
});
check('no-account recovery refreshes the write gate and persists the cleared session', () => {
  assert.equal(clearedReason,'wallet disconnected');
  assert.equal(gated,1);
  assert.equal(persisted,1);
  assert.match(element('jobsBody').innerHTML,/Runtime context reset/);
  assert.equal(element('alphaIdentityTokenImage').style.display,'none');
});
console.log(`\n${checks} release UI checks passed. Mocked function checks; no browser wallet or live-chain transactions.`);
