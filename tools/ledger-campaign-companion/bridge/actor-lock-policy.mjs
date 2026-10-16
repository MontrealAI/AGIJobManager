import * as fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { randomBytes } from 'node:crypto';
import { exclusiveJson } from './private-store.mjs';
import { reject } from './errors.mjs';

export function operatorPolicyDirectory() {
  const home = os.userInfo().homedir;
  return process.platform === 'darwin' ? path.join(home, 'Library', 'Application Support', 'ManualLedgerCampaignCompanion') : path.join(home, '.config', 'manual-ledger-campaign-companion');
}
async function privateDirectory(directory) {
  if (typeof directory !== 'string' || !path.isAbsolute(directory) || path.resolve(directory) !== directory) reject('ACTOR_LOCK_DIRECTORY_REJECTED');
  const root = path.parse(directory).root; let current = root;
  for (const component of directory.slice(root.length).split(path.sep).filter(Boolean)) {
    current = path.join(current, component);
    try { const stat = await fs.lstat(current); if (!stat.isDirectory() || stat.isSymbolicLink()) reject('ACTOR_LOCK_DIRECTORY_REJECTED'); }
    catch (error) { if (error.code !== 'ENOENT') throw error; try { await fs.mkdir(current, { mode: 0o700 }); } catch (creation) { if (creation.code !== 'EEXIST') throw creation; } const stat = await fs.lstat(current); if (!stat.isDirectory() || stat.isSymbolicLink()) reject('ACTOR_LOCK_DIRECTORY_REJECTED'); }
  }
  const stat = await fs.lstat(directory);
  if ((stat.mode & 0o077) !== 0 || (typeof process.getuid === 'function' && stat.uid !== process.getuid()) || await fs.realpath(directory) !== directory) reject('ACTOR_LOCK_DIRECTORY_REJECTED');
  return directory;
}
// Production uses the fixed OS-account config directory. Tests may call this
// helper with a disposable policyDirectory; the launcher exposes no override.
export async function registerActorLockDirectory({ directory, policyDirectory = operatorPolicyDirectory() }) {
  await privateDirectory(policyDirectory); await privateDirectory(directory);
  const filename = path.join(policyDirectory, 'actor-lock-policy.json');
  const policy = { format: 'manual-ledger-operator-lock-policy-v1', ownerUid: typeof process.getuid === 'function' ? process.getuid() : null, actorLockDirectory: directory };
  const temporary = path.join(policyDirectory, `actor-lock-policy-registration-${randomBytes(32).toString('hex')}.json`);
  await exclusiveJson(temporary, policy);
  try { await fs.link(temporary, filename); const handle = await fs.open(policyDirectory, 'r'); try { await handle.sync(); } finally { await handle.close(); } }
  catch (error) {
    if (error.code !== 'EEXIST') throw error;
    const stat = await fs.lstat(filename);
    if (!stat.isFile() || stat.isSymbolicLink() || (stat.mode & 0o777) !== 0o600 || stat.size > 8192 || (typeof process.getuid === 'function' && stat.uid !== process.getuid())) reject('ACTOR_LOCK_POLICY_REJECTED');
    let prior; try { prior = JSON.parse(await fs.readFile(filename, 'utf8')); } catch { reject('ACTOR_LOCK_POLICY_REJECTED'); }
    if (prior.format !== policy.format || prior.ownerUid !== policy.ownerUid || prior.actorLockDirectory !== directory || Object.keys(prior).sort().join('|') !== Object.keys(policy).sort().join('|')) reject('ACTOR_LOCK_DIRECTORY_ALREADY_PINNED');
  }
  finally { await fs.unlink(temporary); }
  return Object.freeze(policy);
}
