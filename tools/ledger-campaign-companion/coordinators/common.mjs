import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawn, execFileSync } from 'node:child_process';
import { Transaction, keccak256 } from 'ethers';
import { validateIntent } from '../src/envelope.mjs';

export const fail = code => { const error = new Error(code); error.code = code; throw error; };
export const need = (value, code) => { if (!value) fail(code); };
export const same = (a, b) => JSON.stringify(canonical(a)) === JSON.stringify(canonical(b));
export function canonical(x) { return Array.isArray(x) ? x.map(canonical) : x && typeof x === 'object' ? Object.fromEntries(Object.keys(x).sort().map(k => [k, canonical(x[k])])) : x; }
export const sha256 = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
export function ordinary(file, limit = 32 * 1024 * 1024) {
  need(typeof file === 'string' && path.isAbsolute(file), 'PRIVATE_ABSOLUTE_PATH_REQUIRED');
  const stat = fs.lstatSync(file);
  need(stat.isFile() && !stat.isSymbolicLink() && stat.size <= limit && fs.realpathSync(file) === file, 'ORDINARY_BOUNDED_FILE_REQUIRED');
  const fd = fs.openSync(file, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW);
  try { const bytes = fs.readFileSync(fd); need(bytes.length <= limit, 'FILE_BOUND_EXCEEDED'); return bytes; } finally { fs.closeSync(fd); }
}
export const readJson = file => { try { return JSON.parse(ordinary(file)); } catch { fail('PRIVATE_JSON_INVALID'); } };
export function directory(file, checkout) {
  need(typeof file === 'string' && path.isAbsolute(file) && fs.realpathSync(file) === file && fs.lstatSync(file).isDirectory(), 'PRIVATE_REAL_DIRECTORY_REQUIRED');
  need(file !== checkout && !file.startsWith(checkout + path.sep), 'PRIVATE_STATE_MUST_BE_OUTSIDE_SOURCE');
  return file;
}
export function privateWrite(dir, value, extension = '.json', selectedName) {
  need(selectedName === undefined || /^[A-Za-z0-9_.-]{1,180}$/.test(selectedName), 'PRIVATE_FILENAME_INVALID');
  const file = path.join(dir, selectedName || crypto.randomUUID() + extension), fd = fs.openSync(file, fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_EXCL | fs.constants.O_NOFOLLOW, 0o600);
  try { fs.writeFileSync(fd, typeof value === 'string' ? value : JSON.stringify(value)); fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
  const parent = fs.openSync(dir, 'r'); try { fs.fsyncSync(parent); } finally { fs.closeSync(parent); }
  return file;
}
export function cleanEnvironment(config = {}) {
  const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !/^(GIT_|NODE_|ALPHA_|MANAGER_|DEPLOYMENT_LOCK_DIRECTORY|HARDHAT_|HTTPS?_PROXY|ALL_PROXY|SSL_CERT_)/i.test(key)));
  Object.assign(env, { GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_SYSTEM: '/dev/null', GIT_CONFIG_GLOBAL: '/dev/null', GIT_NO_REPLACE_OBJECTS: '1', GIT_NO_LAZY_FETCH: '1', GIT_OPTIONAL_LOCKS: '0', GIT_TERMINAL_PROMPT: '0' });
  if (config.extraCaCertificates) env.NODE_EXTRA_CA_CERTS = config.extraCaCertificates;
  return env;
}
// Verify immutable tracked bytes before any source module is executed. This never runs filters/status/hooks.
export function observeSource(config, supported) {
  const root = config.checkout;
  need(typeof root === 'string' && path.isAbsolute(root) && fs.realpathSync(root) === root, 'REAL_CHECKOUT_REQUIRED');
  const git = args => execFileSync('git', ['--no-replace-objects', '-c', 'core.fsmonitor=false', '-c', 'core.hooksPath=/dev/null', '-c', 'core.excludesFile=/dev/null', '-c', 'core.attributesFile=/dev/null', '-c', 'protocol.allow=never', ...args], { cwd: root, env: cleanEnvironment(), encoding: 'utf8', timeout: 30000, maxBuffer: 32 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] });
  need(git(['rev-parse', '--show-toplevel']).trim() === root, 'SOURCE_ROOT_MISMATCH');
  need(git(['rev-parse', 'HEAD']).trim() === supported.commit && git(['rev-parse', 'HEAD^{tree}']).trim() === supported.tree, 'UNSUPPORTED_COORDINATOR_SOURCE');
  const rows = git(['ls-tree', '-rz', '--full-tree', 'HEAD']).split('\0').filter(Boolean), expected = new Map();
  need(rows.length > 0 && rows.length <= 20000, 'SOURCE_TREE_BOUND');
  for (const row of rows) {
    const match = /^(100644|100755|120000) blob ([0-9a-f]{40})\t(.+)$/.exec(row); need(match, 'SOURCE_ENTRY_UNSUPPORTED');
    const [, mode, hash, relative] = match, file = path.resolve(root, relative), stat = fs.lstatSync(file);
    need(file.startsWith(root + path.sep) && fs.realpathSync(path.dirname(file)) === path.dirname(file), 'SOURCE_PATH_ALIAS');
    let bytes;
    if (mode === '120000') { need(stat.isSymbolicLink(), 'SOURCE_TYPE_DRIFT'); bytes = Buffer.from(fs.readlinkSync(file)); }
    else { need(stat.isFile() && !stat.isSymbolicLink() && Boolean(stat.mode & 0o100) === (mode === '100755'), 'SOURCE_MODE_DRIFT'); bytes = ordinary(file, 64 * 1024 * 1024); }
    need(crypto.createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex') === hash, 'SOURCE_BYTES_DRIFT');
    expected.set(relative, `${mode}:${hash}`);
  }
  need(git(['ls-files', '--others', '--exclude-standard', '-z']) === '', 'SOURCE_UNTRACKED');
  need(git(['ls-files', '-v', '-z']).split('\0').filter(Boolean).every(x => x[0] !== 'S' && !/[a-z]/.test(x[0])), 'SOURCE_INDEX_FLAGS');
  const index = git(['ls-files', '--stage', '-z']).split('\0').filter(Boolean);
  need(index.length === expected.size && index.every(row => { const m = /^(\d{6}) ([0-9a-f]{40}) 0\t(.+)$/.exec(row); return m && expected.get(m[3]) === `${m[1]}:${m[2]}`; }), 'SOURCE_INDEX_DRIFT');
  return { repository: supported.repository, commit: supported.commit, tree: supported.tree };
}
export function runtime(config, supported) {
  need(path.isAbsolute(config.nodePath) && fs.realpathSync(config.nodePath) === config.nodePath, 'PINNED_NODE_EXECUTABLE_REQUIRED');
  need(typeof config.nodeVersion === 'string' && supported.nodeVersions.includes(config.nodeVersion) && /^[a-f0-9]{64}$/.test(config.nodeSha256 || ''), 'REVIEWED_NODE_RUNTIME_PIN_REQUIRED');
  need(sha256(ordinary(config.nodePath, 256 * 1024 * 1024)) === config.nodeSha256, 'NODE_EXECUTABLE_HASH_MISMATCH');
  const nodeVersion = execFileSync(config.nodePath, ['--version'], { env: cleanEnvironment(), encoding: 'utf8', timeout: 10000, maxBuffer: 256, stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  need(nodeVersion === `v${config.nodeVersion}`, 'NODE_RUNTIME_VERSION_MISMATCH');
}
export function evaluateOffline(config, supported, code, args) {
  observeSource(config, supported); runtime(config, supported);
  let value;
  try { value = execFileSync(config.nodePath, ['-e', code, ...args], { cwd: config.checkout, env: cleanEnvironment(config), encoding: 'utf8', timeout: 120000, maxBuffer: 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] }); }
  catch { fail('COORDINATOR_OFFLINE_INSPECTION_STOPPED'); }
  observeSource(config, supported);
  try { return JSON.parse(value); } catch { fail('COORDINATOR_OFFLINE_INSPECTION_INVALID'); }
}
export async function execute(config, supported, script, args, env = {}) {
  observeSource(config, supported); runtime(config, supported);
  const child = spawn(config.nodePath, [script, ...args], { cwd: config.checkout, env: { ...cleanEnvironment(config), ...env }, stdio: ['ignore', 'pipe', 'pipe'], shell: false });
  let output = '', diagnostic = '', exceeded = false;
  const timer = setTimeout(() => child.kill('SIGKILL'), 120000);
  child.stdout.on('data', bytes => { output += bytes; if (output.length > 262144) { exceeded = true; child.kill('SIGKILL'); } });
  child.stderr.on('data', bytes => { diagnostic += bytes; if (diagnostic.length > 262144) { exceeded = true; child.kill('SIGKILL'); } });
  const code = await new Promise((resolve, reject) => { child.on('error', () => reject(new Error('COORDINATOR_PROCESS_FAILED'))); child.on('exit', resolve); }).finally(() => clearTimeout(timer));
  need(!exceeded && code === 0, 'COORDINATOR_STOPPED_PRESERVE_PRIVATE_STATE');
  observeSource(config, supported);
  return output;
}
export function reviewed(campaign, supported, count) {
  const manifest = campaign.reviewedManifest, config = campaign.coordinator;
  need(config && manifest && same(manifest.source, { repository: supported.repository, commit: supported.commit, tree: supported.tree }), 'UNREVIEWED_COORDINATOR_SOURCE');
  need(/^[a-f0-9]{64}$/.test(manifest.planSha256 || '') && /^0x[a-f0-9]{64}$/.test(manifest.sourceSha256 || ''), 'REVIEWED_PLAN_REQUIRED');
  need(Array.isArray(manifest.operations) && manifest.operations.length === count && new Set(manifest.operations.map(x => x.operationId)).size === count, 'COMPLETE_REVIEWED_OPERATION_MANIFEST_REQUIRED');
  need(Number.isFinite(Date.parse(campaign.expiresAt)), 'EXPLICIT_CAMPAIGN_EXPIRY_REQUIRED');
  const plan = readJson(config.planPath);
  need(plan.payloadSha256 === manifest.planSha256, 'REVIEWED_PLAN_HASH_MISMATCH');
  const { payloadSha256, ...payload } = plan;
  need(sha256(JSON.stringify(canonical(payload))) === payloadSha256, 'PLAN_SEAL_MISMATCH');
  need(same(plan.source || plan.revision, { ...(plan.source || plan.revision), commit: supported.commit, tree: supported.tree }), 'PLAN_REVISION_MISMATCH');
  observeSource(config, supported);
  return { config, manifest, plan };
}
export function reviewedOperation(campaign, supported, count, step, { allowExpired = false } = {}) {
  need(Number.isSafeInteger(step) && step >= 0 && step < count, 'UNSUPPORTED_OPERATION_INDEX');
  const checked = reviewed(campaign, supported, count), operation = checked.manifest.operations[step];
  need(operation.review?.operationId === operation.operationId && operation.review?.sourceSha256 === checked.manifest.sourceSha256 && operation.review.expiresAt === campaign.expiresAt, 'REVIEWED_OPERATION_POLICY_MISMATCH');
  const prepared = validateIntent(operation.unsignedHex, operation.expectedUnsignedHash, operation.review, operation.expectedPolicyHash, Date.now(), { allowExpired });
  return { ...checked, operation, prepared };
}
export function comparePacket(packet, checked, supported, step) {
  need(packet && packet.schema === supported.packetSchema && packet.index === step && packet.planSha256 === checked.manifest.planSha256, 'UNSUPPORTED_HANDOFF_PACKET');
  need(packet.unsignedSerialized === checked.prepared.unsignedHex && keccak256(packet.unsignedSerialized) === checked.operation.expectedUnsignedHash, 'DURABLE_INTENT_DIFFERS_FROM_REVIEW');
  const { from, ...fields } = packet.envelope || {};
  need(from === checked.prepared.sender && Transaction.from(fields).unsignedSerialized === packet.unsignedSerialized, 'DURABLE_ENVELOPE_MISMATCH');
}
export function validateSignedRaw(raw, prepared) {
  let tx; try { tx = Transaction.from(raw); } catch { fail('SIGNED_CAPABILITY_INVALID'); }
  need(tx.signature && tx.from === prepared.sender && tx.type === 2 && tx.unsignedSerialized === prepared.unsignedHex && tx.unsignedHash === prepared.expectedUnsignedHash, 'SIGNED_CAPABILITY_MISMATCH');
  return tx.hash;
}
export function publicSummary(campaign, supported, count) {
  const { manifest } = reviewed(campaign, supported, count);
  return { coordinator: supported.id, source: manifest.source, packetSchema: supported.packetSchema, planSha256: manifest.planSha256, operationCount: count, candidateQualification: 'REVIEW_CANDIDATE_NOT_MAINNET_QUALIFIED', activationAllowed: false, configurationScope: supported.configurationScope };
}
