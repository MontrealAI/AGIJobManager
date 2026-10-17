'use strict';
// Lightweight external-increment checks only; no EVM or native-source gate.
const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), { createRequire } = require('node:module'), { pathToFileURL } = require('node:url');
const root = path.resolve(__dirname, '../..');
const load = () => import(pathToFileURL(path.join(root, 'scripts/qualification/marker-native-evidence.mjs')).href);
// This external test uses the explicitly selected checkout's existing install.
// No scratch-path fallback, package installation, or production source override.
const sourceRoot = process.env.MANAGER_QUALIFICATION_SOURCE_ROOT;
assert(sourceRoot && path.isAbsolute(sourceRoot), 'Set the absolute qualification source root.');
assert.equal(fs.realpathSync(sourceRoot), sourceRoot, 'Use the canonical qualification source root.');
const E = createRequire(path.join(sourceRoot, 'package.json'))('ethers');
assert.equal(E.version, '6.17.0', 'Use the existing exact source ethers dependency.');
const digest = x => require('node:crypto').createHash('sha256').update(JSON.stringify(x)).digest('hex');
const creator = '0x1111111111111111111111111111111111111111', target = '0x2222222222222222222222222222222222222222', alias = '0x3333333333333333333333333333333333333333';
const step = (op = 'STOP') => ({ op, depth: 1, pc: 0, gas: 1, gasCost: 0, stack: [] });
const trace = () => ({ failed: false, gas: 1, returnValue: '', structLogs: [step()] });
test('input marker reports are visibly synthetic and scoped, with distinct exact report shapes', async () => {
 const { syntheticMarkerReports } = await load(), scope = { fixture: 'unit-shape-only' }, r = syntheticMarkerReports(scope, digest);
 assert.deepEqual(Object.keys(r), ['consensusEvidenceSha256', 'directExecutionEvidenceSha256']);
 assert.equal(r.consensusEvidenceSha256.scope, scope); assert.equal(r.directExecutionEvidenceSha256.scope, scope);
 for (const value of Object.values(r)) { assert.match(value.reviewReference, /SYNTHETIC/); for (const h of Object.values(value.artifacts)) assert.match(h, /^[a-f0-9]{64}$/); }
 assert.deepEqual(r.directExecutionEvidenceSha256.invocations, { creator: 0, target: 0 });
 assert.notEqual(digest(r.directExecutionEvidenceSha256), digest({ ...r.directExecutionEvidenceSha256, invocations: { creator: 1, target: 0 } }));
});
test('complete bounded trace with no calls is accepted', async () => { const { callsFromTrace, assertNoOriginCalls } = await load(); assert.deepEqual(callsFromTrace(trace(), E), []); assert.doesNotThrow(() => assertNoOriginCalls([], creator, target, [], E)); });
test('trace guard rejects direct origin/target entry for all four call opcodes', async () => {
 const { callsFromTrace, assertNoOriginCalls } = await load();
 for (const op of ['CALL', 'CALLCODE', 'DELEGATECALL', 'STATICCALL']) for (const address of [creator, target]) {
  const t = trace(); t.structLogs.unshift({ ...step(op), stack: [address.slice(2).padStart(64, '0'), '01'] }); const calls = callsFromTrace(t, E);
  assert.equal(calls[0].target, address); assert.throws(() => assertNoOriginCalls(calls, creator, target, [], E), /Forbidden origin/);
 }
});
test('trace guard rejects indirect marker callees and missing or substituted runtime reads', async () => {
 const { assertNoOriginCalls } = await load(), calls = [{ op: 'CALL', target: alias }], code = '0xef0100' + target.slice(2), observed = { address: alias, code, codeHash: E.keccak256(code), resolvedMarkerTarget: target };
 assert.throws(() => assertNoOriginCalls(calls, creator, target, [observed], E), /Marker-bearing callee/);
 assert.throws(() => assertNoOriginCalls(calls, creator, target, [], E), /Missing or mismatched/);
 assert.throws(() => assertNoOriginCalls(calls, creator, target, [{ ...observed, codeHash: E.ZeroHash }], E), /Missing or mismatched/);
 assert.doesNotThrow(() => assertNoOriginCalls(calls, creator, target, [{ address: alias, code: '0x00', codeHash: E.keccak256('0x00'), resolvedMarkerTarget: null }], E));
});
test('trace guard rejects incomplete, malformed, oversized and unsupported frames', async () => {
 const { callsFromTrace } = await load();
 for (const change of [t => t.failed = true, t => t.structLogs = [], t => t.structLogs[0].op = 'PUSH1', t => delete t.structLogs[0].stack, t => t.structLogs[0].depth = 2, t => t.structLogs[0].stack = ['1'.repeat(65)], t => t.structLogs = Array(100001).fill(step()), t => t.structLogs.unshift(step('CREATE')), t => t.structLogs.unshift(step('SELFDESTRUCT')), t => t.structLogs.unshift({ ...step('STOP'), depth: 2 })]) { const t = trace(); change(t); assert.throws(() => callsFromTrace(t, E)); }
});
test('external marker runner keeps actual source observation, native draft and strict single-suite selection', () => {
 const text = fs.readFileSync(path.join(root, 'scripts/qualification/core-session-native.mjs'), 'utf8');
 assert(text.includes("if (suite !== 'marker') throw")); assert(text.includes('observeSource(root, expectedCommit, expectedTree)'));
 assert(text.includes("await command('plan', { config: draftFile }")); assert(text.includes("await caseRun('marker-eoa-nine-native-create-completion', () => positive('marker'))"));
 assert(!text.includes('F.source')); assert(!text.includes('core-session-fixture.cjs')); assert(text.includes('syntheticMarkerInputEvidence: true'));
});

test('fixture mining precedes state mutation and preserves the original reviewed block', async () => {
 const { advanceFixtureHeadBeyondPlanPin } = await load();
 const pin = { number: 13, hash: '0x' + '13'.repeat(32) }; let head = 13;
 const states = new Map([[13, { hash: pin.hash, code: 'original' }]]), methods = [];
 const rpc = async (method, params) => {
  methods.push(method);
  if (method === 'eth_getBlockByNumber') { const n = params[0] === 'latest' ? head : Number(BigInt(params[0])); return { number: '0x' + n.toString(16), hash: states.get(n)?.hash }; }
  assert.equal(method, 'hardhat_mine'); const old = states.get(head); head++; states.set(head, { ...old, hash: '0x' + String(head).repeat(32) }); return null;
 };
 const evidence = await advanceFixtureHeadBeyondPlanPin(rpc, pin);
 states.get(head).code = 'mutated';
 assert.equal(states.get(pin.number).code, 'original'); assert(head > pin.number);
 assert.equal(evidence.before.number, '0xd'); assert.equal(evidence.after.number, '0xe');
 assert.equal(methods.filter(x => x === 'hardhat_mine').length, 1);
});
test('fixture isolation refuses changed pins or ineffective mining rather than claiming preservation', async () => {
 const { advanceFixtureHeadBeyondPlanPin } = await load(), pin = { number: 13, hash: '0x' + '13'.repeat(32) };
 let mined = false;
 await assert.rejects(advanceFixtureHeadBeyondPlanPin(async method => { if (method === 'hardhat_mine') mined = true; return { number: '0xd', hash: '0x' + '00'.repeat(32) }; }, pin), /pin changed/);
 assert.equal(mined, false);
 await assert.rejects(advanceFixtureHeadBeyondPlanPin(async method => method === 'hardhat_mine' ? null : { number: '0xd', hash: pin.hash }, pin), /did not advance/);
});
test('marker negatives preserve pinned actor checks and assert full production preflight causes', () => {
 const text = fs.readFileSync(path.join(root, 'scripts/qualification/core-session-native.mjs'), 'utf8');
 const start = text.indexOf("for (const phase of ['handoff', 'relay'])");
 const section = text.slice(start, text.indexOf('async function completionCases', start));
 assert(section.includes('await advanceFixtureHeadBeyondPlanPin(rpc, z.config.block)'));
 assert(section.indexOf('await advanceFixtureHeadBeyondPlanPin') < section.indexOf("await rpc('hardhat_setCode', [address, code])"));
 assert(section.includes('await assert.rejects(verifier.preflight(z.plan, prepared.qualified, source, moduleRpc), reason)'));
 assert(section.includes('assert.deepEqual(await A.observeActor(moduleRpc, z.config, z.config.block), pinnedBefore)'));
});
