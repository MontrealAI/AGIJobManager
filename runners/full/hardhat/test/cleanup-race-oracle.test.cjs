'use strict';
// Shape-only disposable oracle unit fixtures, never production source/session qualification.
const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), os = require('node:os'), path = require('node:path'), { pathToFileURL } = require('node:url');
const root = path.resolve(__dirname, '../..');
const load = async () => ({ ...await import(pathToFileURL(path.join(root, 'scripts/qualification/cleanup-race-oracle.mjs')).href), ...await import(pathToFileURL(path.join(root, 'scripts/qualification/core-session-native.mjs')).href) });
function write(file, value) { fs.writeFileSync(file, typeof value === 'string' ? value : JSON.stringify(value), { mode: 0o600 }); }
async function fixture(run) {
 const { prepareCleanupRace, durableStateDigest } = await load(), dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cleanup-oracle-'));
 try {
  const session = path.join(dir, 'session'), locks = path.join(dir, 'locks'), lock = path.join(locks, 'actor'); fs.mkdirSync(session); fs.mkdirSync(locks);
  for (const name of ['events', 'signed', 'attempts']) fs.mkdirSync(path.join(session, name));
  const own = { path: lock, journalPath: session, token: '99999999-9999-4999-8999-999999999999' }, foreign = { ...own, journalPath: path.join(dir, 'foreign-session'), token: '22222222-2222-4222-8222-222222222222' };
  write(path.join(session, 'session.json'), { creatorLock: own }); write(path.join(session, 'plan.json'), {}); write(path.join(session, 'head.json'), { test: 'unchanged' });
  write(path.join(session, 'events/000000.json'), { action: 'released' }); write(path.join(session, 'signed/0.json'), { raw: 'DISPOSABLE_PRIVATE_UNIT_CAPABILITY' }); write(path.join(session, 'attempts/0.json'), { test: 'unchanged' });
  const before = durableStateDigest(session), oracle = prepareCleanupRace(session, lock, foreign), gate = path.join(session, 'active-command');
  const gateOwner = { token: '11111111-1111-4111-8111-111111111111', pid: 12345 };
  const capture = () => { fs.mkdirSync(gate, { mode: 0o700 }); write(path.join(gate, 'owner.json'), gateOwner); oracle.captureBeforeInjection(); fs.mkdirSync(lock); write(path.join(lock, 'owner.json'), foreign); oracle.captureForeignAfterInjection(); };
  const replaceFile = file => { const bytes = fs.readFileSync(file), mode = fs.statSync(file).mode; fs.renameSync(file, path.join(dir, 'saved-' + path.basename(path.dirname(file)) + '-' + path.basename(file))); fs.writeFileSync(file, bytes, { mode }); };
  const replaceDirectory = file => { fs.renameSync(file, path.join(dir, 'saved-' + path.basename(file))); fs.mkdirSync(file, { mode: 0o700 }); for (const name of fs.readdirSync(path.join(dir, 'saved-' + path.basename(file)))) { const source = path.join(dir, 'saved-' + path.basename(file), name); fs.copyFileSync(source, path.join(file, name)); fs.chmodSync(path.join(file, name), fs.statSync(source).mode); } };
  await run({ dir, session, lock, gate, foreign, before, oracle, capture, replaceFile, replaceDirectory, prepareCleanupRace, durableStateDigest });
 } finally { fs.rmSync(dir, { recursive: true }); }
}
test('exact single-race gate and foreign-lock retention passes without changing any entry', () => fixture(f => {
 f.capture(); assert.notEqual(f.durableStateDigest(f.session), f.before); const result = f.oracle.verifyAfterRejection(f.before);
 assert.equal(result.nonGateSessionDigest, f.before); assert.equal(result.noGateOrForeignLockCleanup, true); assert.equal(result.exactGateRetained.owner.pid, 12345);
 assert.deepEqual(result.exactForeignLockRetained.owner, f.foreign); assert(result.preservedNonGateEntries.some(x => x.path.endsWith('signed/0.json') && x.sha256));
 assert(!JSON.stringify(result).includes('DISPOSABLE_PRIVATE_UNIT_CAPABILITY')); assert.deepEqual(f.oracle.evidence(), result);
}));
for (const [name, mutate] of [
 ['head bytes', f => fs.appendFileSync(path.join(f.session, 'head.json'), ' ')],
 ['same-byte head inode replacement', f => f.replaceFile(path.join(f.session, 'head.json'))],
 ['signed capability bytes', f => fs.appendFileSync(path.join(f.session, 'signed/0.json'), ' ')],
 ['attempt deletion', f => fs.unlinkSync(path.join(f.session, 'attempts/0.json'))],
 ['journal append', f => write(path.join(f.session, 'events/000001.json'), {})],
 ['unrelated new session file', f => write(path.join(f.session, 'new-file'), 'new')],
 ['existing session file mode', f => fs.chmodSync(path.join(f.session, 'plan.json'), 0o700)],
 ['gate owner bytes', f => fs.appendFileSync(path.join(f.gate, 'owner.json'), ' ')],
 ['same-byte gate owner inode replacement', f => f.replaceFile(path.join(f.gate, 'owner.json'))],
 ['gate directory replacement', f => f.replaceDirectory(f.gate)],
 ['gate directory mode', f => fs.chmodSync(f.gate, 0o755)],
 ['unexpected gate entry', f => write(path.join(f.gate, 'extra'), 'extra')],
 ['foreign owner bytes', f => fs.appendFileSync(path.join(f.lock, 'owner.json'), ' ')],
 ['foreign owner inode replacement', f => f.replaceFile(path.join(f.lock, 'owner.json'))],
 ['foreign lock directory replacement', f => f.replaceDirectory(f.lock)],
 ['foreign owner mode', f => fs.chmodSync(path.join(f.lock, 'owner.json'), 0o700)]
]) test('race oracle rejects ' + name, () => fixture(f => { f.capture(); mutate(f); assert.throws(() => f.oracle.verifyAfterRejection(f.before)); }));
test('race oracle requires the captured hook, exact prior digest and absence of a preexisting gate', () => fixture(f => {
 assert.throws(() => f.oracle.verifyAfterRejection(f.before), /hook/); assert.throws(() => f.oracle.evidence(), /verified/);
 f.capture(); assert.throws(() => f.oracle.verifyAfterRejection('0'.repeat(64))); assert.throws(() => f.oracle.captureBeforeInjection(), /once/);
 assert.throws(() => f.prepareCleanupRace(f.session, f.lock, f.foreign), /without an active/);
}));
test('external runner limits oracle to the named last completion race and never cleans its entries', () => {
 const text = fs.readFileSync(path.join(root, 'scripts/qualification/core-session-native.mjs'), 'utf8');
 assert(text.includes("if (commandName === 'complete' && label === CLEANUP_RACE_LABEL)"));
 assert(text.includes('else assert.equal(record.durableAfter, durableBefore'));
 const start = text.indexOf('async function completionCases'), end = text.indexOf('async function exportPathCases', start), completion = text.slice(start, end);
 assert(completion.indexOf('await caseRun(CLEANUP_RACE_LABEL') > completion.indexOf("await caseRun('completion-recovers-exact-empty-tombstone'"));
 assert(!completion.includes('preserved-other-session-lock')); assert(completion.includes('captureBeforeInjection()')); assert(completion.includes('captureForeignAfterInjection()'));
});
