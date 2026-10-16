import { constants } from 'node:fs';
import * as fs from 'node:fs/promises';
import path from 'node:path';
import { createHash, randomBytes } from 'node:crypto';
import os from 'node:os';
import { execFileSync } from 'node:child_process';
import { reject } from './errors.mjs';

export const canonical = value => JSON.stringify(value, (_key, child) => child && typeof child === 'object' && !Array.isArray(child) ? Object.fromEntries(Object.keys(child).sort().map(key => [key, child[key]])) : child);
export const sha256 = value => createHash('sha256').update(typeof value === 'string' ? value : canonical(value)).digest('hex');
const inside = (parent, child) => { const relative = path.relative(parent, child); return relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative)); };
async function noSymlinkPath(target) {
  const absolute = path.resolve(target), parsed = path.parse(absolute);
  let current = parsed.root;
  for (const component of absolute.slice(parsed.root.length).split(path.sep).filter(Boolean)) {
    current = path.join(current, component);
    let stat; try { stat = await fs.lstat(current); } catch (error) { if (error.code === 'ENOENT') return absolute; throw error; }
    if (stat.isSymbolicLink()) reject('PRIVATE_PATH_REJECTED');
    if (current !== absolute && !stat.isDirectory()) reject('PRIVATE_PATH_REJECTED');
  }
  return absolute;
}
async function syncDirectory(directory) {
  const handle = await fs.open(directory, constants.O_RDONLY | constants.O_DIRECTORY); try { await handle.sync(); } finally { await handle.close(); }
}
async function hostContext() {
  try {
    if (process.platform === 'linux') {
      const [machine, boot, namespace] = await Promise.all([fs.readFile('/etc/machine-id', 'utf8'), fs.readFile('/proc/sys/kernel/random/boot_id', 'utf8'), fs.stat('/proc/self/ns/pid')]);
      if (!/^[0-9a-f]{32}\s*$/.test(machine) || !/^[0-9a-f-]{36}\s*$/.test(boot)) return null;
      return { platform: 'linux', host: sha256(`${os.hostname()}|${machine.trim()}`), boot: sha256(`${boot.trim()}|${namespace.ino}`) };
    }
    if (process.platform === 'darwin') {
      const options = { encoding: 'utf8', maxBuffer: 128 * 1024, stdio: ['ignore', 'pipe', 'pipe'], timeout: 5000 };
      const hardware = execFileSync('/usr/sbin/ioreg', ['-rd1', '-c', 'IOPlatformExpertDevice'], options).match(/"IOPlatformUUID"\s*=\s*"([0-9A-Fa-f-]{36})"/);
      const boot = execFileSync('/usr/sbin/sysctl', ['-n', 'kern.bootsessionuuid'], options).trim();
      if (!hardware || !/^[0-9A-Fa-f-]{36}$/.test(boot)) return null;
      return { platform: 'darwin', host: sha256(`${os.hostname()}|${hardware[1].toLowerCase()}`), boot: sha256(boot.toLowerCase()) };
    }
  } catch { /* Unknown host/boot identity never authorizes lock retirement. */ }
  return null;
}
export async function exclusiveJson(filename, value) {
  const handle = await fs.open(filename, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600);
  try { await handle.writeFile(`${canonical(value)}\n`, 'utf8'); await handle.sync(); } finally { await handle.close(); }
  await syncDirectory(path.dirname(filename));
}
export async function openPrivateStore({ directory, campaign, forbiddenRoots = [], recoverDeadOwner = false }) {
  if (typeof directory !== 'string' || !path.isAbsolute(directory)) reject('PRIVATE_PATH_REJECTED');
  const root = await noSymlinkPath(directory);
  for (const forbidden of forbiddenRoots) if (typeof forbidden === 'string' && inside(await noSymlinkPath(forbidden), root)) reject('PRIVATE_PATH_REJECTED');
  await fs.mkdir(root, { mode: 0o700, recursive: true });
  const rootStat = await fs.lstat(root);
  if (!rootStat.isDirectory() || rootStat.isSymbolicLink() || (rootStat.mode & 0o077) !== 0 || (typeof process.getuid === 'function' && rootStat.uid !== process.getuid())) reject('PRIVATE_PATH_REJECTED');
  const manifestDigest = sha256(campaign), manifestPath = path.join(root, 'reviewed-campaign.json');
  try { await exclusiveJson(manifestPath, { format: 'private-reviewed-campaign-v1', manifestDigest, campaign }); }
  catch (error) {
    if (error.code !== 'EEXIST') throw error;
    const stat = await fs.lstat(manifestPath); if (!stat.isFile() || stat.isSymbolicLink() || (stat.mode & 0o077) !== 0) reject('PRIVATE_PATH_REJECTED');
    const prior = JSON.parse(await fs.readFile(manifestPath, 'utf8'));
    if (prior.manifestDigest !== manifestDigest || canonical(prior.campaign) !== canonical(campaign)) reject('CAMPAIGN_CHANGED');
  }
  const lock = path.join(root, 'bridge-owner.lock');
  const owner = { format: 'bridge-owner-v1', pid: process.pid, nonce: randomBytes(32).toString('hex'), manifestDigest, hostContext: await hostContext() };
  let recoveredOwner = false;
  try { await exclusiveJson(lock, owner); }
  catch (error) {
    if (error.code !== 'EEXIST') throw error;
    if (recoverDeadOwner !== true) reject('CAMPAIGN_ALREADY_OPEN');
    const claim = path.join(root, 'bridge-owner-recovery-claim.lock');
    try { await exclusiveJson(claim, { format: 'bridge-owner-recovery-claim-v1', nonce: owner.nonce, manifestDigest }); } catch { reject('BRIDGE_OWNER_RECOVERY_BLOCKED'); }
    try {
      const stat = await fs.lstat(lock);
      if (!stat.isFile() || stat.isSymbolicLink() || (stat.mode & 0o777) !== 0o600 || stat.size > 8192 || (typeof process.getuid === 'function' && stat.uid !== process.getuid())) reject('BRIDGE_OWNER_RECOVERY_BLOCKED');
      const previous = JSON.parse(await fs.readFile(lock, 'utf8'));
      if (previous.format !== 'bridge-owner-v1' || previous.manifestDigest !== manifestDigest || !owner.hostContext || canonical(previous.hostContext) !== canonical(owner.hostContext) || !Number.isSafeInteger(previous.pid) || previous.pid < 1 || previous.pid > 2147483647 || !/^[0-9a-f]{64}$/.test(previous.nonce ?? '')) reject('BRIDGE_OWNER_RECOVERY_BLOCKED');
      let definitelyDead = false;
      try { process.kill(previous.pid, 0); } catch (probe) { if (probe.code === 'ESRCH') definitelyDead = true; }
      if (!definitelyDead) reject('BRIDGE_OWNER_RECOVERY_BLOCKED');
      await fs.link(lock, path.join(root, `retired-bridge-owner-${previous.nonce}.json`));
      await fs.unlink(lock); await syncDirectory(root); await exclusiveJson(lock, owner); recoveredOwner = true;
    } finally { await fs.unlink(claim); await syncDirectory(root); }
  }
  let revision = 0, latest = null, closed = false;
  try {
    const entries = (await fs.readdir(root)).filter(name => /^state-[0-9]{8}\.json$/.test(name)).sort();
    for (const entry of entries) {
      revision += 1;
      if (entry !== `state-${String(revision).padStart(8, '0')}.json`) reject('PRIVATE_STATE_REJECTED');
      const filename = path.join(root, entry), stat = await fs.lstat(filename);
      if (!stat.isFile() || stat.isSymbolicLink() || (stat.mode & 0o077) !== 0 || stat.size > 2 * 1024 * 1024) reject('PRIVATE_STATE_REJECTED');
      const parsed = JSON.parse(await fs.readFile(filename, 'utf8'));
      if (parsed.manifestDigest !== manifestDigest || parsed.revision !== revision || parsed.previousDigest !== (latest ? sha256(latest) : null)) reject('PRIVATE_STATE_REJECTED');
      latest = parsed;
    }
  } catch (error) { await fs.unlink(lock); throw error; }
  return Object.freeze({
    root, manifestDigest, recoveredOwner,
    get snapshot() { return latest ? JSON.parse(JSON.stringify(latest.state)) : null; },
    async append(state) {
      if (closed) reject('PRIVATE_STORE_CLOSED');
      const record = { format: 'private-campaign-state-v1', manifestDigest, revision: revision + 1, previousDigest: latest ? sha256(latest) : null, state: JSON.parse(JSON.stringify(state)) };
      await exclusiveJson(path.join(root, `state-${String(record.revision).padStart(8, '0')}.json`), record);
      revision = record.revision; latest = record;
    },
    async capability(step, capability) {
      if (closed || !Number.isSafeInteger(step) || step < 0) reject('PRIVATE_STATE_REJECTED');
      const name = `signed-step-${String(step).padStart(4, '0')}-${sha256(capability)}.json`;
      try { await exclusiveJson(path.join(root, name), capability); }
      catch (error) { if (error.code !== 'EEXIST') throw error; const stat = await fs.lstat(path.join(root, name)); if (!stat.isFile() || stat.isSymbolicLink() || (stat.mode & 0o077) !== 0 || await fs.readFile(path.join(root, name), 'utf8') !== `${canonical(capability)}\n`) reject('PRIVATE_STATE_REJECTED'); }
      return name;
    },
    async readCapabilities() {
      const values = [];
      for (const name of (await fs.readdir(root)).filter(entry => /^signed-step-[0-9]{4}-[0-9a-f]{64}\.json$/.test(entry)).sort()) {
        const filename = path.join(root, name), stat = await fs.lstat(filename);
        if (!stat.isFile() || stat.isSymbolicLink() || (stat.mode & 0o077) !== 0 || stat.size > 400 * 1024) reject('PRIVATE_STATE_REJECTED');
        const value = JSON.parse(await fs.readFile(filename, 'utf8'));
        if (!name.endsWith(`-${sha256(value)}.json`)) reject('PRIVATE_STATE_REJECTED');
        values.push({ name, step: Number(name.slice(12, 16)), value });
      }
      return values;
    },
    async close() {
      if (closed) return;
      closed = true;
      const current = JSON.parse(await fs.readFile(lock, 'utf8'));
      if (current.nonce !== owner.nonce) reject('PRIVATE_STATE_REJECTED');
      await fs.unlink(lock); await syncDirectory(root);
    }
  });
}
