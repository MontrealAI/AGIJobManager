import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { Interface, Transaction, getAddress, getCreateAddress, keccak256 } from 'ethers';

const stop = code => { throw Object.assign(new Error(code), { code }); };
const need = (test, code) => { if (!test) stop(code); };
export const canonical = value => Array.isArray(value) ? value.map(canonical) : value && typeof value === 'object' ? Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])])) : value;
export const digest = value => createHash('sha256').update(typeof value === 'string' || Buffer.isBuffer(value) ? value : JSON.stringify(canonical(value))).digest('hex');
const same = (a, b) => JSON.stringify(canonical(a)) === JSON.stringify(canonical(b));
const copy = value => JSON.parse(JSON.stringify(value));
const freeze = value => { if (value && typeof value === 'object') { for (const child of Object.values(value)) freeze(child); Object.freeze(value); } return value; };
const hash = value => typeof value === 'string' && /^[0-9a-f]{64}$/.test(value);
const hex = value => typeof value === 'string' && /^(?:[0-9a-f]{2})*$/.test(value);
const address = value => { try { return getAddress(value); } catch { stop('TRUST_ADDRESS_INVALID'); } };
const soljsonDriver = fileURLToPath(new URL('./soljson-driver.cjs', import.meta.url));
const compilerCoreVersion = version => version.replace(/\.(?:Linux\.g\+\+|Darwin\.appleclang|Emscripten\.clang)$/, '');
function exact(value, keys, code = 'TRUST_POLICY_INVALID') { need(value && typeof value === 'object' && !Array.isArray(value) && same(Object.keys(value).sort(), [...keys].sort()), code); }

export function ordinaryFile(filename, limit = 64 * 1024 * 1024) {
  need(typeof filename === 'string' && path.isAbsolute(filename) && fs.realpathSync(filename) === filename, 'TRUST_REAL_FILE_REQUIRED');
  const stat = fs.lstatSync(filename);
  need(stat.isFile() && !stat.isSymbolicLink() && stat.size <= limit, 'TRUST_BOUNDED_FILE_REQUIRED');
  const fd = fs.openSync(filename, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW);
  try { const bytes = fs.readFileSync(fd); need(bytes.length <= limit, 'TRUST_FILE_TOO_LARGE'); return bytes; } finally { fs.closeSync(fd); }
}
function trackedRead(filename, sha256, tracked, limit) {
  need(hash(sha256), 'TRUST_FILE_PIN_REQUIRED'); const bytes = ordinaryFile(filename, limit);
  need(digest(bytes) === sha256, 'TRUST_FILE_HASH_MISMATCH'); tracked.set(filename, sha256); return bytes;
}
function parseJson(bytes) { try { return JSON.parse(bytes.toString('utf8')); } catch { stop('TRUST_JSON_INVALID'); } }
function boundedCompiler(executable, args, input) {
  try { return execFileSync(executable, args, { input, encoding: 'utf8', shell: false, env: { LANG: 'C', LC_ALL: 'C' }, cwd: path.dirname(executable), timeout: 120000, maxBuffer: 128 * 1024 * 1024, stdio: ['pipe', 'pipe', 'pipe'] }); }
  catch { stop('LOCAL_COMPILER_FAILED'); }
}
function parseCompilerVersion(stdout, expected) {
  const versions = stdout.split(/\r?\n/).filter(line => line.startsWith('Version: '));
  need(versions.length === 1 && versions[0].slice(9) === expected, 'LOCAL_COMPILER_VERSION_MISMATCH');
}
function contractParts(contract) {
  need(contract && Array.isArray(contract.abi) && contract.evm?.bytecode && contract.evm?.deployedBytecode, 'LOCAL_COMPILER_CONTRACT_MISSING');
  return { abi: contract.abi, bytecode: contract.evm.bytecode.object, deployedBytecode: contract.evm.deployedBytecode.object,
    linkReferences: contract.evm.bytecode.linkReferences || {}, deployedLinkReferences: contract.evm.deployedBytecode.linkReferences || {}, immutableReferences: contract.evm.deployedBytecode.immutableReferences || {} };
}
function artifactParts(artifact) {
  const result = { abi: artifact.abi, bytecode: artifact.bytecode?.replace(/^0x/, ''), deployedBytecode: artifact.deployedBytecode?.replace(/^0x/, ''), linkReferences: artifact.linkReferences || {}, deployedLinkReferences: artifact.deployedLinkReferences || {} };
  if (Object.hasOwn(artifact, 'immutableReferences')) result.immutableReferences = artifact.immutableReferences;
  return result;
}
function fullQualified(output, qualifiedName) {
  const colon = qualifiedName.lastIndexOf(':'); need(colon > 0, 'TRUST_QUALIFIED_CONTRACT_REQUIRED');
  const contract = output.contracts?.[qualifiedName.slice(0, colon)]?.[qualifiedName.slice(colon + 1)];
  return { contract, parts: contractParts(contract) };
}

// The policy digest is an independent review input. Computing a digest from an Ubuntu
// proposal does not authorize that proposal. No compiler is downloaded or selected here.
export function reproduceLocalBuild({ policy: suppliedPolicy, expectedPolicySha256, sourceRoot, observeSource }) {
  need(hash(expectedPolicySha256) && digest(suppliedPolicy) === expectedPolicySha256, 'INDEPENDENT_TRUST_POLICY_REQUIRED');
  const policy = freeze(copy(suppliedPolicy));
  exact(policy, ['schema', 'source', 'campaignSha256', 'planSha256', 'builds']);
  need(policy.schema === 'manual-ledger-local-build-policy-v1' && hash(policy.campaignSha256) && hash(policy.planSha256), 'TRUST_POLICY_INVALID');
  need(typeof observeSource === 'function', 'INDEPENDENT_SOURCE_OBSERVER_REQUIRED');
  need(typeof sourceRoot === 'string' && path.isAbsolute(sourceRoot) && fs.realpathSync(sourceRoot) === sourceRoot && fs.lstatSync(sourceRoot).isDirectory(), 'LOCAL_SOURCE_CHECKOUT_REQUIRED');
  need(same(observeSource(), policy.source), 'TRUST_SOURCE_MISMATCH');
  need(Array.isArray(policy.builds) && policy.builds.length > 0 && policy.builds.length <= 16, 'TRUST_BUILD_BOUND');
  const tracked = new Map(), contracts = new Map(), reports = [];
  for (const build of policy.builds) {
    exact(build, ['id', 'compiler', 'input', 'sources', 'outputs', 'contracts']);
    need(typeof build.id === 'string' && /^[A-Za-z0-9._-]{1,128}$/.test(build.id), 'TRUST_BUILD_ID_INVALID');
    need(['native', 'soljson'].includes(build.compiler?.kind), 'TRUST_COMPILER_KIND_UNSUPPORTED');
    exact(build.compiler, build.compiler.kind === 'native' ? ['kind', 'path', 'sha256', 'version'] : ['kind', 'path', 'sha256', 'version', 'nodePath', 'nodeSha256', 'nodeVersion']);
    const compiler = build.compiler;
    trackedRead(compiler.path, compiler.sha256, tracked, 256 * 1024 * 1024);
    need(/^0\.8\.37\+commit\.f401782d\.(?:Linux\.g\+\+|Darwin\.appleclang|Emscripten\.clang)$/.test(compiler.version), 'COMPILER_VERSION_NOT_REVIEWED');
    if (compiler.kind === 'native') { need((fs.lstatSync(compiler.path).mode & 0o111) !== 0, 'NATIVE_COMPILER_PIN_REQUIRED'); parseCompilerVersion(boundedCompiler(compiler.path, ['--version']), compiler.version); }
    else {
      need(compiler.version.endsWith('.Emscripten.clang') && /^\d+\.\d+\.\d+$/.test(compiler.nodeVersion), 'SOLJSON_RUNTIME_PIN_REQUIRED');
      trackedRead(compiler.nodePath, compiler.nodeSha256, tracked, 256 * 1024 * 1024);
      need(boundedCompiler(compiler.nodePath, ['--version']).trim() === `v${compiler.nodeVersion}`, 'SOLJSON_NODE_VERSION_MISMATCH');
      tracked.set(soljsonDriver, digest(ordinaryFile(soljsonDriver)));
    }
    exact(build.input, ['path', 'sha256']);
    const input = parseJson(trackedRead(build.input.path, build.input.sha256, tracked));
    need(input.language === 'Solidity' && input.settings && typeof input.settings === 'object' && input.sources && !Array.isArray(input.sources), 'STANDARD_JSON_INPUT_REQUIRED');
    need(build.sources && same(Object.keys(build.sources).sort(), Object.keys(input.sources).sort()) && Object.keys(build.sources).length > 0 && Object.keys(build.sources).length <= 10000, 'COMPLETE_LOCAL_SOURCE_CLOSURE_REQUIRED');
    for (const [unit, descriptor] of Object.entries(build.sources)) {
      exact(descriptor, ['path', 'sha256']); exact(input.sources[unit], ['content'], 'EMBEDDED_SOURCE_CONTENT_ONLY');
      need(typeof descriptor.path === 'string' && descriptor.path.startsWith(sourceRoot + path.sep), 'SOURCE_CLOSURE_OUTSIDE_LOCAL_CHECKOUT');
      need(typeof input.sources[unit].content === 'string' && trackedRead(descriptor.path, descriptor.sha256, tracked, 16 * 1024 * 1024).equals(Buffer.from(input.sources[unit].content, 'utf8')), 'LOCAL_SOURCE_CONTENT_MISMATCH');
    }
    // Full embedded source closure and no import callback prevent remote or filesystem imports.
    const output = compiler.kind === 'native'
      ? parseJson(Buffer.from(boundedCompiler(compiler.path, ['--standard-json'], JSON.stringify(input))))
      : parseJson(Buffer.from(boundedCompiler(compiler.nodePath, [soljsonDriver], JSON.stringify({ compilerPath: compiler.path, compilerSha256: compiler.sha256, expectedVersion: compiler.version, input })))).output;
    need(output && typeof output === 'object' && !output.errors?.some(error => error.severity === 'error'), 'LOCAL_COMPILER_REPORTED_ERRORS');
    need(Array.isArray(build.outputs) && build.outputs.length > 0 && build.outputs.length <= 128, 'TRUST_OUTPUT_BOUND');
    for (const descriptor of build.outputs) {
      need(descriptor && ['compiler-output', 'hardhat-build-info', 'artifact'].includes(descriptor.kind), 'TRUST_OUTPUT_KIND_UNSUPPORTED');
      const expectedKeys = descriptor.kind === 'artifact' ? ['kind', 'path', 'sha256', 'qualifiedName'] : ['kind', 'path', 'sha256']; exact(descriptor, expectedKeys);
      const expected = parseJson(trackedRead(descriptor.path, descriptor.sha256, tracked));
      if (descriptor.kind === 'compiler-output') need(same(expected.output || expected, output), 'LOCAL_COMPILER_OUTPUT_MISMATCH');
      else if (descriptor.kind === 'hardhat-build-info') need(same(expected.input, input) && same(expected.output, output) && [compilerCoreVersion(compiler.version), compiler.version].includes(expected.solcLongVersion), 'LOCAL_BUILD_INFO_MISMATCH');
      else {
        const compiled = fullQualified(output, descriptor.qualifiedName).parts, artifact = artifactParts(expected);
        if (!Object.hasOwn(artifact, 'immutableReferences')) delete compiled.immutableReferences;
        need(same(compiled, artifact), 'LOCAL_ARTIFACT_MISMATCH');
      }
    }
    need(build.contracts && Object.keys(build.contracts).length > 0 && Object.keys(build.contracts).length <= 128, 'TRUST_CONTRACT_BOUND');
    for (const [name, qualifiedName] of Object.entries(build.contracts)) {
      need(/^[A-Za-z_][A-Za-z0-9_]*$/.test(name) && typeof qualifiedName === 'string' && !contracts.has(name), 'TRUST_CONTRACT_DUPLICATE');
      const { parts } = fullQualified(output, qualifiedName); contracts.set(name, freeze({ qualifiedName, ...copy(parts) }));
    }
    reports.push({ id: build.id, compilerVersion: compiler.version, compilerSha256: compiler.sha256, inputSha256: digest(input), outputSha256: digest(output), sourceCount: Object.keys(input.sources).length, contracts: copy(build.contracts) });
  }
  need(same(observeSource(), policy.source), 'TRUST_SOURCE_CHANGED_DURING_BUILD');
  const assertUnchanged = () => { need(same(observeSource(), policy.source), 'TRUST_SOURCE_MISMATCH'); for (const [filename, checksum] of tracked) need(digest(ordinaryFile(filename, 256 * 1024 * 1024)) === checksum, 'TRUST_FILE_CHANGED'); return true; };
  assertUnchanged();
  const receipt = freeze({ schema: 'manual-ledger-local-build-receipt-v1', platform: process.platform, policySha256: expectedPolicySha256, source: copy(policy.source), campaignSha256: policy.campaignSha256, planSha256: policy.planSha256, builds: reports, locallyRecompiled: true, physicalQualified: false, authorityComplete: false, activationAuthorized: false });
  const records = Object.freeze({ get: name => contracts.get(name), get size() { return contracts.size; }, names: () => [...contracts.keys()] });
  return Object.freeze({ receipt, contracts: records, assertUnchanged });
}

function linkBytecode(object, references, links) {
  need(typeof object === 'string' && object.length % 2 === 0, 'LOCAL_BYTECODE_INVALID'); let result = object;
  for (const [source, names] of Object.entries(references)) for (const [name, positions] of Object.entries(names)) {
    const key = `${source}:${name}`, projectAlias = source.startsWith('project/') ? `${source.slice(8)}:${name}` : key;
    const selected = links?.[key] ?? links?.[projectAlias] ?? links?.[name]; need(typeof selected === 'string', 'LOCAL_LIBRARY_LINK_REQUIRED');
    const value = address(selected).slice(2).toLowerCase();
    need(Array.isArray(positions), 'LOCAL_LINK_REFERENCES_INVALID');
    for (const position of positions) { need(Number.isSafeInteger(position.start) && position.start >= 0 && position.length === 20 && (position.start + 20) * 2 <= result.length, 'LOCAL_LINK_REFERENCES_INVALID'); result = result.slice(0, position.start * 2) + value + result.slice((position.start + 20) * 2); }
  }
  need(hex(result), 'LOCAL_LIBRARY_LINK_UNRESOLVED'); return `0x${result}`;
}

// Native checkPlan must still validate the economic policy and complete plan semantics.
// This independently binds those native plan operations to locally compiled bytes.
export function bindCampaignToLocalBuild({ campaign, plan, build, nativePlanValidated }) {
  need(nativePlanValidated === true, 'LOCAL_NATIVE_PLAN_VALIDATION_REQUIRED'); build.assertUnchanged();
  need(digest(campaign) === build.receipt.campaignSha256 && plan.payloadSha256 === build.receipt.planSha256 && campaign.reviewedManifest?.planSha256 === plan.payloadSha256 && same(campaign.reviewedManifest.source, build.receipt.source), 'LOCAL_CAMPAIGN_BINDING_MISMATCH');
  const creations = campaign.adapter === 'manager' ? plan.operations : campaign.adapter === 'alpha' ? plan.transactions : null;
  need(Array.isArray(creations) && creations.length === (campaign.adapter === 'manager' ? 9 : 5), 'LOCAL_ARCHITECTURE_UNSUPPORTED');
  need(build.contracts.size === creations.length && campaign.reviewedManifest.operations.length === creations.length + (campaign.adapter === 'alpha' ? 2 : 0), 'COMPLETE_LOCAL_ARCHITECTURE_REQUIRED');
  const creator = address(campaign.actors.creator), governor = address(campaign.actors.governor); need(creator !== governor && governor === address('0xd76AD27a1Bcf8652e7e46BE603FA742FD1c10A99'), 'LOCAL_ACTOR_POLICY_MISMATCH');
  const addresses = new Map(), results = []; let previousNonce = null;
  for (const [index, operation] of creations.entries()) {
    const record = build.contracts.get(operation.name); need(record, 'LOCAL_CONTRACT_NOT_REPRODUCED');
    const reviewed = campaign.reviewedManifest.operations[index], tx = Transaction.from(reviewed.unsignedHex);
    need(!tx.signature && tx.type === 2 && tx.chainId === 1n && tx.to === null && tx.value === 0n && tx.accessList.length === 0 && address(reviewed.review.expectedSender) === creator, 'LOCAL_CREATE_ENVELOPE_MISMATCH');
    need(previousNonce === null || tx.nonce === previousNonce + 1, 'LOCAL_CREATE_NONCE_GAP'); previousNonce = tx.nonce;
    const predicted = getCreateAddress({ from: creator, nonce: tx.nonce }); need(predicted === address(operation.predictedAddress || operation.expectedAddress), 'LOCAL_CREATE_ADDRESS_MISMATCH'); addresses.set(operation.name, predicted);
    const links = operation.libraries || plan.libraries || {}, bytecode = linkBytecode(record.bytecode, record.linkReferences, links);
    const data = bytecode + new Interface(record.abi).encodeDeploy(operation.constructorArguments).slice(2);
    need(tx.data === data.toLowerCase(), 'LOCAL_CREATE_DATA_MISMATCH');
    if (operation.envelope) { const { from, ...envelope } = operation.envelope; need(address(from) === creator && Transaction.from(envelope).unsignedSerialized === tx.unsignedSerialized, 'LOCAL_NATIVE_ENVELOPE_MISMATCH'); }
    results.push({ index, name: operation.name, address: predicted, unsignedHash: tx.unsignedHash, dataHash: keccak256(tx.data), qualifiedName: record.qualifiedName });
  }
  // Linked addresses must be creations in this exact graph. Existing external dependencies
  // remain constructor arguments and are separately checked by the reviewed native plan.
  for (const operation of creations) for (const [name, selected] of Object.entries(operation.libraries || plan.libraries || {})) need(address(selected) === addresses.get(name.split(':').at(-1)), 'LOCAL_LIBRARY_OUTSIDE_NEW_GRAPH');
  if (campaign.adapter === 'alpha') {
    const allowed = [['AscensionRiskOracle', 'bindMarketplace', 'AscensionJobMarket'], ['AscensionJobMarket', 'bindMark', 'AscensionMark']];
    need(Array.isArray(plan.governanceCalls) && plan.governanceCalls.length === 2, 'LOCAL_BINDING_SCOPE_MISMATCH'); let governorNonce = null;
    for (const [offset, [name, method, argument]] of allowed.entries()) {
      const index = creations.length + offset, reviewed = campaign.reviewedManifest.operations[index], tx = Transaction.from(reviewed.unsignedHex), call = plan.governanceCalls[offset], record = build.contracts.get(name);
      const expectedData = new Interface(record.abi).encodeFunctionData(method, [addresses.get(argument)]);
      need(!tx.signature && tx.type === 2 && tx.chainId === 1n && tx.to === addresses.get(name) && tx.value === 0n && tx.accessList.length === 0 && tx.data === expectedData && address(reviewed.review.expectedSender) === governor && call.name === name && call.method === method && address(call.argument) === addresses.get(argument) && call.data === expectedData && address(call.to) === tx.to && address(call.from) === governor, 'LOCAL_BINDING_ENVELOPE_MISMATCH');
      need(governorNonce === null || tx.nonce === governorNonce + 1, 'LOCAL_GOVERNOR_NONCE_GAP'); governorNonce = tx.nonce;
      results.push({ index, name, method, address: tx.to, unsignedHash: tx.unsignedHash, dataHash: keccak256(tx.data) });
    }
  }
  return freeze({ ...copy(build.receipt), operations: results, nativePlanValidated: true, exactTransactionBytesValidated: true });
}

export function assertTrustedSigningHost() { need(process.platform === 'darwin', 'TRUSTED_MAC_SIGNING_HOST_REQUIRED'); return true; }

export function createTrustedCampaignContext({ campaign, plan, policy, expectedPolicySha256, sourceRoot, observeSource, nativePlanValidated }) {
  const reviewedCampaign = freeze(copy(campaign)), reviewedPlan = freeze(copy(plan));
  const build = reproduceLocalBuild({ policy, expectedPolicySha256, sourceRoot, observeSource });
  const receipt = bindCampaignToLocalBuild({ campaign: reviewedCampaign, plan: reviewedPlan, build, nativePlanValidated });
  const assertUnchanged = () => {
    build.assertUnchanged();
    const currentPlan = parseJson(ordinaryFile(reviewedCampaign.coordinator.planPath));
    need(same(currentPlan, reviewedPlan), 'LOCAL_NATIVE_PLAN_CHANGED');
    return true;
  };
  assertUnchanged(); return Object.freeze({ receipt, assertUnchanged });
}

export function assertCampaignUnstartedForReplacement({ privateDirectory, nativeSessionPath }) {
  const exists = filename => { try { fs.lstatSync(filename); return true; } catch (error) { if (error.code === 'ENOENT') return false; stop('TRUST_EXISTING_STATE_UNREADABLE'); } };
  if (nativeSessionPath && exists(nativeSessionPath)) stop('EXISTING_NATIVE_SESSION_REQUIRES_RECONCILIATION');
  if (!exists(privateDirectory)) return true;
  need(fs.realpathSync(privateDirectory) === privateDirectory && fs.lstatSync(privateDirectory).isDirectory() && (fs.lstatSync(privateDirectory).mode & 0o077) === 0, 'TRUST_PRIVATE_DIRECTORY_REQUIRED');
  for (const name of fs.readdirSync(privateDirectory)) {
    if (/^signed-step-|^bridge-owner/.test(name)) stop('EXISTING_CAMPAIGN_REQUIRES_RECONCILIATION');
    if (/^state-[0-9]{8}\.json$/.test(name)) {
      const record = parseJson(ordinaryFile(path.join(privateDirectory, name), 2 * 1024 * 1024));
      need(record.state && Array.isArray(record.state.steps), 'TRUST_PRIVATE_STATE_INVALID');
      need(record.state.steps.every(step => ['awaiting-owner-approval', 'blocked'].includes(step.state) && !step.prepared && !step.signingRequestedAt && !step.transactionHash && !step.relayAttempted && !step.capabilityFile), 'EXISTING_CAMPAIGN_REQUIRES_RECONCILIATION');
    }
  }
  return true;
}
