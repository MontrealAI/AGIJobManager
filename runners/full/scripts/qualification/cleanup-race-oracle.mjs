// Test-only oracle for the one completed-session/foreign-lock-arrival race.
// It never removes or changes a guard, journal, signature, attempt or lock.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const exists = file => { try { fs.lstatSync(file); return true; } catch (error) { if (error.code === 'ENOENT') return false; throw error; } };
function pin(file, kind) {
  const stat = fs.lstatSync(file, { bigint: true });
  assert(!stat.isSymbolicLink() && (kind === 'directory' ? stat.isDirectory() : stat.isFile()), 'Race oracle requires real entry types');
  assert.equal(fs.realpathSync(file), path.resolve(file));
  const result = { path: file, dev: String(stat.dev), ino: String(stat.ino), mode: String(stat.mode), kind };
  if (kind === 'file') { result.bytes = fs.readFileSync(file); result.sha256 = sha(result.bytes); result.size = result.bytes.length; }
  return result;
}
function samePin(saved) {
  const current = pin(saved.path, saved.kind);
  assert.deepEqual(current, saved, 'Race oracle entry identity, mode or bytes changed');
}
function ownedDirectory(directory) {
  const directoryPin = pin(directory, 'directory'), names = fs.readdirSync(directory).sort();
  assert.deepEqual(names, ['owner.json']); const ownerPin = pin(path.join(directory, 'owner.json'), 'file');
  return { directoryPin, names, ownerPin, owner: JSON.parse(ownerPin.bytes.toString('utf8')) };
}
function sameOwned(saved) {
  samePin(saved.directoryPin); assert.deepEqual(fs.readdirSync(saved.directoryPin.path).sort(), saved.names);
  samePin(saved.ownerPin); assert.deepEqual(JSON.parse(fs.readFileSync(saved.ownerPin.path, 'utf8')), saved.owner);
}
function withoutGateDigest(directory) {
  const entries = [];
  function visit(file, relative) {
    const stat = fs.lstatSync(file), mode = stat.mode & 0o777;
    if (stat.isSymbolicLink()) entries.push([relative, 'symlink', mode, fs.readlinkSync(file)]);
    else if (stat.isDirectory()) { entries.push([relative, 'directory', mode]); for (const name of fs.readdirSync(file).sort()) if (relative !== '' || name !== 'active-command') visit(path.join(file, name), path.join(relative, name)); }
    else { assert(stat.isFile()); entries.push([relative, 'file', mode, sha(fs.readFileSync(file))]); }
  }
  visit(directory, ''); return sha(JSON.stringify(entries));
}
function nonGatePins(directory) {
  const result = [];
  function visit(file, relative) {
    const stat = fs.lstatSync(file); assert(!stat.isSymbolicLink(), 'Race baseline contains a session alias');
    result.push(pin(file, stat.isDirectory() ? 'directory' : 'file'));
    if (stat.isDirectory()) for (const name of fs.readdirSync(file).sort()) if (relative !== '' || name !== 'active-command') visit(path.join(file, name), path.join(relative, name));
  }
  visit(directory, ''); return result;
}
function publicPin(p) { const { bytes, ...rest } = p; return rest; }
function publicOwned(p) { return { directoryPin: publicPin(p.directoryPin), names: p.names, ownerPin: publicPin(p.ownerPin), owner: p.owner }; }
export function prepareCleanupRace(session, lockPath, expectedForeignOwner) {
  assert.equal(exists(path.join(session, 'active-command')), false, 'Race must start without an active command');
  assert.equal(exists(lockPath), false, 'Race must start without an original creator lock');
  const meta = JSON.parse(fs.readFileSync(path.join(session, 'session.json')));
  assert.equal(meta.creatorLock.path, lockPath); assert.equal(meta.creatorLock.journalPath, session);
  assert.notEqual(expectedForeignOwner.token, meta.creatorLock.token);
  const events = fs.readdirSync(path.join(session, 'events')).sort(); assert(events.length > 0);
  assert.equal(JSON.parse(fs.readFileSync(path.join(session, 'events', events.at(-1)))).action, 'released', 'Race requires an already released session');
  const sessionPin = pin(session, 'directory'), beforeDigest = withoutGateDigest(session), preservedPins = nonGatePins(session);
  const unchanged = () => { for (const value of preservedPins) samePin(value); assert.equal(withoutGateDigest(session), beforeDigest, 'Race changed non-gate session state'); };
  let active, foreign, verified;
  return Object.freeze({
    session, beforeDigest,
    captureBeforeInjection() {
      assert.equal(active, undefined, 'Race hook must execute once'); samePin(sessionPin);
      unchanged(); assert.equal(exists(lockPath), false);
      active = ownedDirectory(path.join(session, 'active-command'));
      assert.deepEqual(Object.keys(active.owner).sort(), ['pid', 'token']);
      assert(Number.isSafeInteger(active.owner.pid) && active.owner.pid > 0); assert.match(active.owner.token, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    },
    captureForeignAfterInjection() {
      assert(active && !foreign); sameOwned(active); samePin(sessionPin);
      unchanged(); foreign = ownedDirectory(lockPath);
      assert.deepEqual(foreign.owner, expectedForeignOwner);
    },
    verifyAfterRejection(beforeCommandDigest) {
      assert(active && foreign, 'Exact race hook and foreign-lock capture required'); assert.equal(beforeCommandDigest, beforeDigest);
      samePin(sessionPin); sameOwned(active); sameOwned(foreign);
      unchanged();
      verified = { scope: 'ONLY completed-session foreign-lock-arrival race', nonGateSessionDigest: beforeDigest, preservedNonGateEntries: preservedPins.map(publicPin), exactGateRetained: publicOwned(active), exactForeignLockRetained: publicOwned(foreign), noGateOrForeignLockCleanup: true };
      return verified;
    },
    evidence() { assert(verified, 'Race must be verified before reporting'); return structuredClone(verified); }
  });
}
