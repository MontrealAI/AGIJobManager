import test from 'node:test';
import assert from 'node:assert/strict';
import { authorityScope, collectAuthorityReport, GOVERNOR } from '../verification/authority.mjs';

const pins = { manager: { repository: 'MontrealAI/AGIJobManager', commit: 'c2f72180d2f0d6ecd5b92d8e5197c5344be2c699', tree: '8b0d8816ce3cdaa1103d37eaa34f4d40bf72972f' }, alpha: { repository: 'MontrealAI/AGI-Alpha-Agent-v0', commit: '38064bec3423218f87c6b81760ac6768b3e7d4e5', tree: '4fe59cb9b8c7e65ea087fd27b0e2abed6bf34c68' } };
function fixture(adapter = 'manager') { const scope = authorityScope(adapter, pins[adapter]); return { adapter, source: pins[adapter], creator: '0x1111111111111111111111111111111111111111', governor: GOVERNOR, graph: Object.fromEntries(scope.components.map((name, i) => [name, `0x${String(i + 20).padStart(40, '0')}`])), snapshot: { number: 6, hash: `0x${'aa'.repeat(32)}` }, read: async query => query.expected, checkCanonical: async () => true }; }
test('scope enumerates exact selected9/5 components and distinct token decimals', () => {
  const manager = authorityScope('manager', pins.manager), alpha = authorityScope('alpha', pins.alpha);
  assert.equal(manager.components.length, 9); assert.equal(alpha.components.length, 5); assert.equal(manager.route.decimals, 6); assert.equal(alpha.route.decimals, 18);
  assert.match(alpha.initialState, /No global pause/); assert.deepEqual(alpha.newProxies, []); assert.deepEqual(manager.newImplementations, []);
});
test('Manager matrix contains owner, pending transfer, moderator, fuses, economic config and rescue powers', () => {
  const matrix = authorityScope('manager', pins.manager).matrix, powers = matrix.flatMap(item => item.powers);
  for (const power of ['transferOwnership', 'acceptOwnership', 'resolveDisputeWithCode', 'lockJobENS(jobId,true)', 'setValidatorBondParams', 'setSettlementWallets', 'rescueERC20', 'setAgentNftRequired']) assert.ok(powers.includes(power));
});
test('Alpha matrix preserves actual inherited renunciation, one-time binding, NFT and treasury permissions', () => {
  const matrix = authorityScope('alpha', pins.alpha).matrix, powers = matrix.flatMap(item => item.powers);
  for (const power of ['renounceOwnership', 'bindMarketplace', 'bindMark', 'route', 'ERC721 transfer/approval operations']) assert.ok(powers.includes(power));
  assert.ok(!powers.some(power => /^pause/.test(power)));
});
test('unknown revision, unsupported Jobs, wrong governor and duplicate graph reject before reads', async () => {
  assert.throws(() => authorityScope('jobs', pins.manager), /AUTHORITY_SOURCE_UNREVIEWED/); assert.throws(() => authorityScope('alpha', { ...pins.alpha, commit: '0'.repeat(40) }), /AUTHORITY_SOURCE_UNREVIEWED/);
  const f = fixture(); f.read = async () => { throw Error('must not read'); }; await assert.rejects(collectAuthorityReport({ ...f, governor: f.creator }), /AUTHORITY_ACTOR_POLICY/); const graph = Object.fromEntries(Object.keys(f.graph).map(name => [name, f.creator])); await assert.rejects(collectAuthorityReport({ ...f, graph }), /ARCHITECTURE/);
});
test('bounded trusted reads match core but never certify external authority or activation', async () => {
  for (const adapter of ['manager', 'alpha']) { const f = fixture(adapter), seen = []; f.read = async query => { seen.push(query); assert.equal(query.chainId, 1); assert.deepEqual(query.block, f.snapshot); assert.ok(Object.values(f.graph).includes(query.target)); return query.expected; }; const report = await collectAuthorityReport(f); assert.equal(report.boundedCoreStateMatches, true); assert.equal(report.authorityComplete, false); assert.equal(report.productionApproved, false); assert.ok(report.blockers.length >= 7); assert.ok(seen.length < 50); }
});
test('missing or mismatched pending ownership/roles remain explicit blockers', async () => {
  const f = fixture(); f.read = async query => { if (query.id.endsWith('pendingOwner')) return f.creator; if (query.id.endsWith('moderators.creator')) throw Error('unavailable'); return query.expected; }; const report = await collectAuthorityReport(f); assert.equal(report.boundedCoreStateMatches, false); assert.ok(report.blockers.includes('MISMATCH:AGIJobManager.pendingOwner')); assert.ok(report.blockers.includes('MISSING:AGIJobManager.moderators.creator'));
});
test('canonical drift before or after reads aborts report', async () => {
  await assert.rejects(collectAuthorityReport({ ...fixture(), checkCanonical: async () => false }), /CANONICAL_READS/); let checks = 0; await assert.rejects(collectAuthorityReport({ ...fixture(), checkCanonical: async () => ++checks === 1 }), /CANONICAL_READS/);
});
