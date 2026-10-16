import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import manager from '../coordinators/manager.mjs';
import alpha from '../coordinators/alpha.mjs';
import { observeSource } from '../coordinators/common.mjs';
import { digest, ordinaryFile, reproduceLocalBuild, bindCampaignToLocalBuild } from './local-build.mjs';

const stop = code => { throw Object.assign(new Error(code), { code }); };
const need = (value, code) => { if (!value) stop(code); };
const json = filename => JSON.parse(ordinaryFile(filename).toString('utf8'));
const descriptor = filename => { const real = fs.realpathSync(filename); return { path: real, sha256: digest(ordinaryFile(real)) }; };
function privateOutput(directory, name, value) {
  need(path.isAbsolute(directory) && fs.realpathSync(directory) === directory, 'LOCAL_REVIEW_DIRECTORY_REQUIRED'); const stat = fs.lstatSync(directory);
  need(stat.isDirectory() && (stat.mode & 0o077) === 0 && (typeof process.getuid !== 'function' || stat.uid === process.getuid()), 'LOCAL_REVIEW_DIRECTORY_REQUIRED');
  const filename = path.join(directory, name), fd = fs.openSync(filename, fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_EXCL | fs.constants.O_NOFOLLOW, 0o600);
  try { fs.writeFileSync(fd, JSON.stringify(value)); fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
  const parent = fs.openSync(directory, 'r'); try { fs.fsyncSync(parent); } finally { fs.closeSync(parent); }
  return descriptor(filename);
}
function localSource(root, candidate) { const real = fs.realpathSync(candidate); need(real.startsWith(root + path.sep), 'SOURCE_CLOSURE_OUTSIDE_LOCAL_CHECKOUT'); return descriptor(real); }
function sourceClosure(root, adapter, input) {
  return Object.fromEntries(Object.keys(input.sources).map(unit => {
    let candidate;
    if (adapter === 'manager') {
      if (unit.startsWith('project/')) candidate = path.join(root, 'hardhat', unit.slice(8));
      else { const match = /^npm\/(.+)@([^/]+)\/(.+)$/.exec(unit); need(match, 'LOCAL_MANAGER_SOURCE_UNIT_UNSUPPORTED'); candidate = path.join(root, 'hardhat', 'node_modules', match[1], match[3]); }
    } else candidate = path.join(root, 'tests/contracts', unit.startsWith('@') ? 'node_modules' : '', unit);
    const selected = localSource(root, candidate); need(ordinaryFile(selected.path).toString('utf8') === input.sources[unit].content, 'LOCAL_COMPILER_SOURCE_DIFFERS'); return [unit, selected];
  }));
}

// Produces an UNAPPROVED review proposal. The printed checksum is an integrity value,
// never owner approval. The production launcher requires its independent review input.
export function prepareLocalReviewPolicy({ campaign, compiler, privateDirectory, supported, nativePlanValidated }) {
  need(nativePlanValidated === true, 'LOCAL_NATIVE_PLAN_VALIDATION_REQUIRED');
  const root = campaign.coordinator.checkout, source = observeSource(campaign.coordinator, supported), plan = json(campaign.coordinator.planPath);
  need(digest(ordinaryFile(compiler.path)) === compiler.sha256, 'INDEPENDENT_COMPILER_HASH_MISMATCH');
  const builds = [];
  if (campaign.adapter === 'manager') {
    const config = campaign.coordinator, catalog = json(config.catalogPath); need(digest(ordinaryFile(config.catalogPath)) === config.catalogSha256, 'REVIEWED_CATALOG_HASH_MISMATCH');
    const entry = catalog.builds?.[config.buildId]; need(entry, 'REVIEWED_BUILD_ID_REQUIRED'); const base = path.dirname(config.catalogPath), resolve = item => path.resolve(base, item.path);
    const wrapper = json(resolve(entry.input)), input = wrapper.input || wrapper, contracts = {}, outputs = [{ kind: 'compiler-output', ...descriptor(resolve(entry.output)) }];
    for (const [name, artifactDescriptor] of Object.entries(entry.artifacts)) {
      const file = resolve(artifactDescriptor), artifact = json(file), inputName = artifact.inputSourceName || wrapper.userSourceNameMap?.[artifact.sourceName] || artifact.sourceName;
      contracts[name] = `${inputName}:${name}`; outputs.push({ kind: 'artifact', ...descriptor(file), qualifiedName: contracts[name] });
    }
    builds.push({ id: config.buildId, compiler, input: privateOutput(privateDirectory, 'local-manager-standard-input.json', input), sources: sourceClosure(root, 'manager', input), outputs, contracts });
  } else if (campaign.adapter === 'alpha') {
    const grouped = new Map();
    for (const [name, contract] of Object.entries(plan.contracts)) {
      const artifactPath = path.join(root, 'tests/contracts/artifacts', contract.sourceName, `${name}.json`), debug = json(artifactPath.replace(/\.json$/, '.dbg.json'));
      const buildPath = fs.realpathSync(path.resolve(path.dirname(artifactPath), debug.buildInfo)), buildInfo = json(buildPath);
      if (!grouped.has(buildPath)) grouped.set(buildPath, { buildInfo, contracts: {}, outputs: [{ kind: 'hardhat-build-info', ...descriptor(buildPath) }] });
      const selected = grouped.get(buildPath); selected.contracts[name] = `${contract.sourceName}:${name}`; selected.outputs.push({ kind: 'artifact', ...descriptor(artifactPath), qualifiedName: selected.contracts[name] });
    }
    for (const { buildInfo, contracts, outputs } of grouped.values()) builds.push({ id: buildInfo.id, compiler, input: privateOutput(privateDirectory, `local-alpha-${buildInfo.id}-standard-input.json`, buildInfo.input), sources: sourceClosure(root, 'alpha', buildInfo.input), outputs, contracts });
  } else stop('LOCAL_REVIEW_ARCHITECTURE_UNSUPPORTED');
  return { schema: 'manual-ledger-local-build-policy-v1', source, campaignSha256: digest(campaign), planSha256: plan.payloadSha256, builds };
}

const usage = 'node trust/prepare-review.mjs --campaign /absolute/private/campaign.json --reviewed-campaign-sha256 EXACT_INDEPENDENT_REVIEW_DIGEST --compiler /absolute/official-soljson.js --compiler-sha256 EXACT_INDEPENDENT_COMPILER_DIGEST --node /absolute/pinned-node --node-sha256 EXACT_INDEPENDENT_NODE_DIGEST --out /absolute/private/mac-trust-policy.json';
function options(argv) {
  if (argv.length === 1 && argv[0] === '--help') return null; const options = {};
  for (let index = 0; index < argv.length; index += 2) { const key = argv[index], value = argv[index + 1]; need(['--campaign','--reviewed-campaign-sha256','--compiler','--compiler-sha256','--node','--node-sha256','--out'].includes(key) && !Object.hasOwn(options, key) && typeof value === 'string' && !value.startsWith('--'), 'LOCAL_REVIEW_ARGUMENTS_INVALID'); options[key] = value; }
  need(Object.keys(options).length === 7 && ['--campaign','--compiler','--node','--out'].every(key => path.isAbsolute(options[key])) && ['--reviewed-campaign-sha256','--compiler-sha256','--node-sha256'].every(key => /^[a-f0-9]{64}$/.test(options[key])), 'LOCAL_REVIEW_ARGUMENTS_INVALID'); return options;
}
async function main() {
  const selected = options(process.argv.slice(2)); if (!selected) { process.stdout.write(`${usage}\n`); return; }
  const campaignFile = descriptor(selected['--campaign']), stat = fs.lstatSync(campaignFile.path); need(campaignFile.path === selected['--campaign'] && (stat.mode & 0o077) === 0, 'PRIVATE_CAMPAIGN_REQUIRED');
  const campaign = json(campaignFile.path); need(digest(campaign) === selected['--reviewed-campaign-sha256'], 'INDEPENDENT_CAMPAIGN_REVIEW_REQUIRED');
  const base = { manager, alpha }[campaign.adapter]; need(base, 'LOCAL_REVIEW_ARCHITECTURE_UNSUPPORTED'); const adapter = base.forCampaign ? base.forCampaign(campaign) : base;
  adapter.inspectCampaign(campaign); const compilerPath = fs.realpathSync(selected['--compiler']), nodePath = fs.realpathSync(selected['--node']);
  need(compilerPath === selected['--compiler'] && nodePath === selected['--node'] && digest(ordinaryFile(compilerPath)) === selected['--compiler-sha256'] && digest(ordinaryFile(nodePath, 256 * 1024 * 1024)) === selected['--node-sha256'], 'INDEPENDENT_COMPILER_RUNTIME_PINS_REQUIRED');
  const nodeVersion = execFileSync(nodePath, ['--version'], { env: { LANG: 'C', LC_ALL: 'C' }, encoding: 'utf8', timeout: 10000, maxBuffer: 256 }).trim().replace(/^v/, '');
  const compiler = { kind: 'soljson', path: compilerPath, sha256: selected['--compiler-sha256'], version: '0.8.37+commit.f401782d.Emscripten.clang', nodePath, nodeSha256: selected['--node-sha256'], nodeVersion };
  const privateDirectory = path.dirname(selected['--out']), policy = prepareLocalReviewPolicy({ campaign, compiler, privateDirectory, supported: adapter.supported, nativePlanValidated: true });
  const build = reproduceLocalBuild({ policy, expectedPolicySha256: digest(policy), sourceRoot: campaign.coordinator.checkout, observeSource: () => observeSource(campaign.coordinator, adapter.supported) });
  const receipt = bindCampaignToLocalBuild({ campaign, plan: json(campaign.coordinator.planPath), build, nativePlanValidated: true });
  const output = privateOutput(privateDirectory, path.basename(selected['--out']), policy);
  process.stdout.write(JSON.stringify({ schema: 'manual-ledger-local-review-proposal-v1', state: 'UNAPPROVED_OWNER_REVIEW_REQUIRED', policyPath: output.path, integritySha256: digest(policy), locallyRecompiled: receipt.locallyRecompiled, operationCount: receipt.operations.length, source: receipt.source, relayAuthorized: false }) + '\n');
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main().catch(() => { process.stderr.write('LOCAL_REVIEW_PROPOSAL_BLOCKED: preserve existing campaign state and independently review source/compiler/build inputs.\n'); process.exitCode = 1; });
