import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const freeze = value => {
  for (const item of Object.values(value)) if (item && typeof item === 'object') freeze(item);
  return Object.freeze(value);
};

export const JOBS_COMPATIBILITY = freeze({
  repository: 'MontrealAI/AGIJobsv0',
  commit: 'fed83bc183753e871621fc1cb3aa8510bd38f642',
  equivalentMergeCommit: 'bd45f34de1c1e58986aafb4b0e5c48bc155839ca',
  tree: 'a49fa5d32272555e62431363f1ffd36b84ea87be',
  packetSchema: null,
  route: { token: '$AGIALPHA', decimals: 18 },
  externalSigningSupported: false,
  missingInterfaces: [
    'Versioned immutable campaign and per-operation unsigned type-2 packet with exact gas/fee/nonce/expiry bounds.',
    'Durable prepare-only intent plus required actor locks that survive each manual Ledger wait and recovery.',
    'External signed-transaction import bound to stored intent, recovered creator, every envelope field and capability hash.',
    'Separately reviewed acknowledgement and one-shot relay; attempted status must prohibit retries or new signing after lost output.',
    'Signer-free canonical observation/recovery protocol consumable by this companion between every operation.',
    'Explicit allowlist of deployment, handover and supported configuration operations; later governor configuration is not a generic-call escape hatch.',
  ],
  configurationScope: {
    sourcePath: 'scripts/v2/deployDefaults.ts',
    sourceSupports: ['commitConfiguration', 'deployComponent', 'registerModules', 'deployPaused', 'transferOwnership'],
    companionCanExecute: [],
    needsOwnerPolicy: ['separate creator/governor/treasuries', 'explicit economics', 'ENS policy', 'tax policy', 'canonical campaign anchor'],
    outsideScope: ['later governance configuration', 'ENS custody/approvals', 'funding', 'admission', 'unpause/activation'],
  },
});

const status = freeze({
  coordinator: 'jobs',
  compatibility: JOBS_COMPATIBILITY,
  referenceInventoryOnly: true,
  campaignValidated: false,
  state: 'blocked',
  blocker: 'JOBS_EXTERNAL_SIGNING_UNSUPPORTED',
  message: 'Jobs uses a coupled Hardhat signer/deploy/wait path. A {raw} export cannot complete its integration.',
  messageFr: 'Jobs utilise un parcours Hardhat couplant signature, déploiement et attente. Un export {raw} ne complète pas son intégration.',
  canPrepare: false,
  canSign: false,
  canImport: false,
  canRelay: false,
  authorityComplete: false,
  activationReady: false,
  productionApproved: false,
});

function unsupported() {
  const error = new Error('JOBS_EXTERNAL_SIGNING_UNSUPPORTED: reviewed external-signing adapter is missing; no operation was requested.');
  error.code = 'JOBS_EXTERNAL_SIGNING_UNSUPPORTED';
  throw error;
}

// These functions deliberately never inspect their arguments or touch a provider,
// device, lock, journal or transaction. Unknown/new Jobs versions remain refused.
export const jobsAdapter = Object.freeze({
  id: 'jobs',
  supported: Object.freeze({ repository: JOBS_COMPATIBILITY.repository, commit: JOBS_COMPATIBILITY.commit, packetSchema: null }),
  inspectCampaign() { return status; },
  prepare: unsupported,
  importSigned: unsupported,
  observe: unsupported,
  relayOne: unsupported,
});

function git(root, args) {
  const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith('GIT_')));
  Object.assign(env, { GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_SYSTEM: '/dev/null', GIT_CONFIG_GLOBAL: '/dev/null', GIT_OPTIONAL_LOCKS: '0' });
  return execFileSync('git', ['--no-replace-objects', '-c', 'core.fsmonitor=false', '-c', 'core.hooksPath=/dev/null', '-c', 'core.untrackedCache=false', '-C', root, ...args], { env, maxBuffer: 8 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] });
}

function blob(bytes) {
  return createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
}

// Read-only provenance inventory, never a deployment or hardware qualification.
// Git plumbing has no status/diff/filter calls; raw file bytes and executable
// modes are compared twice against the exact known tree, ignoring index flags.
export function inspectJobsSource(directory) {
  try {
    const root = fs.realpathSync(directory);
    if (fs.realpathSync(git(root, ['rev-parse', '--show-toplevel']).toString().trim()) !== root) throw new Error();
    const commit = git(root, ['rev-parse', 'HEAD']).toString().trim();
    const tree = git(root, ['rev-parse', 'HEAD^{tree}']).toString().trim();
    if (![JOBS_COMPATIBILITY.commit, JOBS_COMPATIBILITY.equivalentMergeCommit].includes(commit) || tree !== JOBS_COMPATIBILITY.tree) throw new Error();
    const entries = git(root, ['ls-tree', '-rz', '--full-tree', 'HEAD']).toString('utf8').split('\0').filter(Boolean).map(line => {
      const tab = line.indexOf('\t');
      const [mode, type, hash] = line.slice(0, tab).split(' ');
      const relative = line.slice(tab + 1);
      if (!['100644', '100755'].includes(mode) || type !== 'blob' || !/^[0-9a-f]{40}$/.test(hash) || !relative || path.isAbsolute(relative) || relative.split('/').some(part => ['.', '..'].includes(part))) throw new Error();
      return { mode, hash, relative };
    });
    const files = [];
    for (let pass = 0; pass < 2; pass++) {
      for (const entry of entries) {
        const file = path.join(root, entry.relative);
        const stat = fs.lstatSync(file);
        if (!stat.isFile() || stat.isSymbolicLink() || fs.realpathSync(file) !== file || Boolean(stat.mode & 0o111) !== (entry.mode === '100755')) throw new Error();
        const bytes = fs.readFileSync(file);
        if (blob(bytes) !== entry.hash) throw new Error();
        if (!pass) files.push({ path: entry.relative, mode: entry.mode, sha256: createHash('sha256').update(bytes).digest('hex') });
      }
      if (git(root, ['rev-parse', 'HEAD']).toString().trim() !== commit || git(root, ['rev-parse', 'HEAD^{tree}']).toString().trim() !== tree) throw new Error();
    }
    return { schema: 'manual-ledger/jobs-source-inventory/v1', commit, tree, trackedFiles: files.length, trackedBytesAndModesMatch: true, untrackedFilesChecked: false, coordinatorExecuted: false, hardwareQualified: false, capabilities: status, files };
  } catch {
    const error = new Error('JOBS_SOURCE_UNRECOGNIZED_OR_CHANGED: inventory refused; no coordinator was executed.');
    error.code = 'JOBS_SOURCE_UNRECOGNIZED_OR_CHANGED';
    throw error;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const [action, option, directory, ...extra] = process.argv.slice(2);
    if (action !== 'inspect-source' || option !== '--source-root' || !directory || extra.length) unsupported();
    console.log(JSON.stringify(inspectJobsSource(directory), null, 2));
  } catch (error) {
    console.error(error?.code === 'JOBS_EXTERNAL_SIGNING_UNSUPPORTED' ? 'JOBS_EXTERNAL_SIGNING_UNSUPPORTED' : 'JOBS_SOURCE_UNRECOGNIZED_OR_CHANGED');
    process.exitCode = 1;
  }
}

export default jobsAdapter;
