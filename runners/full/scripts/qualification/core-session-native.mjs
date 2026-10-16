#!/usr/bin/env node
// EXTERNAL full-harness oracle revision. Production source and prior results remain frozen.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { prepareCleanupRace } from './cleanup-race-oracle.mjs';
import { sha256, readJson, writeNew, sourceModules, observeSource, cleanGit, safeExternalPath, prepareCoreCatalog, parseFlags } from './prepare-core-catalog.mjs';
const here = path.dirname(fileURLToPath(import.meta.url));
const harnessRoot = path.resolve(here, '../..');
const ownRequire = createRequire(import.meta.url);
const { createNativeCoreRpc } = ownRequire('../../hardhat/test/helpers/native-core-rpc.cjs');
export const REPORT_SCHEMA = 'manager-native-core-session-qualification-v1';
export const NODE_VERSION = 'v22.23.2';
export const NATIVE_FAILURE_MESSAGES = Object.freeze({
  core: 'MANAGER_CORE_COMMAND_FAILED: Stop and preserve private inputs and the session. Inspect or recover before any retry; no activation was authorized.',
  export: 'MANAGER_VERIFICATION_EXPORT_FAILED: Stop and preserve private inputs and any incomplete export. No explorer acceptance or activation was established.'
});
// Native CLI errors are deliberately redacted. Detailed cause assertions belong
// to module tests; a crash, timeout, arbitrary stderr or leaked detail is no pass.
export function assertNativeFailure(child, kind = 'core', label = kind) {
  assert(Object.hasOwn(NATIVE_FAILURE_MESSAGES, kind));
  assert.equal(child.code, 1, `${label}: expected handled CLI rejection`);
  assert.equal(child.signal, null, `${label}: child terminated by signal`);
  assert.equal(child.timedOut, false, `${label}: child timed out`);
  assert.equal(child.oversized, false, `${label}: child output exceeded its bound`);
  assert.equal(child.stdout, '', `${label}: failure emitted success output`);
  assert.equal(child.stderr, NATIVE_FAILURE_MESSAGES[kind] + '\n', `${label}: unexpected or unredacted failure output`);
}
// Hash private bytes locally; never include capabilities or follow aliases. This
// checks the entire existing session, including head, signed files and attempts.
export function durableStateDigest(directory) {
  const entries = [];
  function visit(file, relative) {
    let stat;
    try { stat = fs.lstatSync(file); } catch (error) { if (error.code === 'ENOENT') { entries.push([relative, 'absent']); return; } throw error; }
    const mode = stat.mode & 0o777;
    if (stat.isSymbolicLink()) entries.push([relative, 'symlink', mode, fs.readlinkSync(file)]);
    else if (stat.isDirectory()) { entries.push([relative, 'directory', mode]); for (const name of fs.readdirSync(file).sort()) visit(path.join(file, name), path.join(relative, name)); }
    else { assert(stat.isFile(), 'Unexpected private-state entry type'); entries.push([relative, 'file', mode, sha256(fs.readFileSync(file))]); }
  }
  visit(directory, ''); return sha256(JSON.stringify(entries));
}
const USDC = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48';
const REGISTRY = '0x2222222222222222222222222222222222222222';
const FLAGS = ['source-root', 'output', 'expected-commit', 'expected-tree', 'build-id', 'suite'];
const LEGACY_FLAGS = ['legacy-source-root', 'legacy-artifacts-root', 'legacy-commit', 'legacy-tree'];

export function childEnvironment(extra = {}) {
  // Do not inherit injected Node loaders, TLS bypasses, provider URLs, keys, Git
  // redirection or coverage settings. Each CLI gets only this disposable scope.
  const env = { PATH: path.dirname(process.execPath) + path.delimiter + (process.env.PATH || '/usr/bin:/bin'), HOME: process.env.HOME || '/tmp', LANG: 'C.UTF-8', TZ: 'UTC' };
  for (const [key, value] of Object.entries(extra)) if (typeof value === 'string') env[key] = value;
  if (env.NODE_TLS_REJECT_UNAUTHORIZED !== undefined || env.NODE_OPTIONS !== undefined) throw Error('Native fixture forbids Node/TLS bypass configuration.');
  return env;
}
export function nativeProcess(script, args, { cwd, env = childEnvironment(), input, timeoutMs = 360000 } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [script, ...args], { cwd, env, stdio: ['pipe', 'pipe', 'pipe'] });
    const stdout = [], stderr = []; let size = 0, timedOut = false, oversized = false;
    const timer = setTimeout(() => { timedOut = true; child.kill('SIGKILL'); }, timeoutMs);
    for (const [stream, chunks] of [[child.stdout, stdout], [child.stderr, stderr]]) stream.on('data', chunk => {
      size += chunk.length; if (size > 4 * 1024 * 1024) { oversized = true; child.kill('SIGKILL'); } else chunks.push(chunk);
    });
    child.on('error', error => { clearTimeout(timer); reject(error); });
    child.on('close', (code, signal) => { clearTimeout(timer); resolve({ code, signal, timedOut, oversized, stdout: Buffer.concat(stdout).toString(), stderr: Buffer.concat(stderr).toString() }); });
    child.stdin.on('error', () => {}); child.stdin.end(input);
  });
}
function countRaw(snapshot) { return snapshot?.counts?.relay?.eth_sendRawTransaction || 0; }
function fileInventory(directory, relative = '') {
  const out = [];
  for (const name of fs.readdirSync(path.join(directory, relative)).sort()) {
    if ((['private', 'source-probes', 'SHA256SUMS', 'report.json', 'INCOMPLETE'].includes(name) && !relative) || name === 'signed') continue;
    const rel = path.join(relative, name), stat = fs.lstatSync(path.join(directory, rel));
    if (stat.isDirectory()) out.push(...fileInventory(directory, rel));
    else if (stat.isFile()) out.push({ path: rel, bytes: stat.size, sha256: sha256(fs.readFileSync(path.join(directory, rel))) });
  }
  return out;
}
function initialConfig(E, P, creator, nonce, block) {
  return { schema: 'manager-core-creation-config-v1', chainId: 1, creator, governor: P.GOVERNOR, governorAcknowledgement: P.GOVERNOR,
    nonce, block, expiresAfterBlock: block.number + 2048,
    constructorArgs: { usdcTokenAddress: USDC, baseIpfsUrl: 'ipfs://native-disposable/', ensConfig: [REGISTRY, E.ZeroAddress], rootNodes: ['club.agi.eth', 'agent.agi.eth', 'alpha.club.agi.eth', 'alpha.agent.agi.eth'].map(E.namehash), merkleRoots: Array(2).fill(E.ZeroHash), settlementWallets: ['0x3333333333333333333333333333333333333333', '0x4444444444444444444444444444444444444444'], initialGovernor: P.GOVERNOR },
    creatorPolicy: { mode: 'empty-eoa-direct-create.v1' }, qualificationEvidence: null,
    envelopes: P.NAMES.map(name => ({ gasLimit: name === 'AGIJobManager' ? '8000000' : '1200000', maxFeePerGas: '10000000000', maxPriorityFeePerGas: '1000000000' })), maximumTotalFeeWei: '176000000000000000' };
}

export async function runNativeQualification({ sourceRoot, outputDirectory, expectedCommit, expectedTree, buildId, suite = 'full', legacy }) {
  if (process.version !== NODE_VERSION) throw Error(`Use exactly Node ${NODE_VERSION}.`);
  if (!['full', 'positive', 'source'].includes(suite)) throw Error('Suite must be full, positive or source.');
  const root = fs.realpathSync(sourceRoot), output = safeExternalPath(outputDirectory, [root, harnessRoot]);
  // Preserve the original error before any fixture can install or replace an identity.
  const source = observeSource(root, expectedCommit, expectedTree);
  fs.mkdirSync(output, { mode: 0o700 });
  for (const name of ['commands', 'outputs', 'scenarios', 'private', 'source-probes']) fs.mkdirSync(path.join(output, name), { mode: 0o700 });
  writeNew(path.join(output, 'INCOMPLETE'), 'Native qualification in progress. Do not delete failed journals or reuse this directory.\n');
  const { require, P, C } = sourceModules(root), E = require('ethers'), T = require(path.join(root, 'hardhat/scripts/transaction-envelope.cjs')), A = require(path.join(root, 'hardhat/scripts/actor-policy.cjs'));
  const report = { schema: REPORT_SCHEMA, startedAt: new Date().toISOString(), status: 'RUNNING', suite, sourceRoot: root, source,
    sourceIncludesHarness: root === harnessRoot, parents: cleanGit(root, 'show', '-s', '--format=%P', 'HEAD').split(' ').filter(Boolean),
    harnessFiles: Object.fromEntries(['scripts/qualification/core-session-native.mjs', 'scripts/qualification/prepare-core-catalog.mjs', 'hardhat/test/helpers/native-core-rpc.cjs', 'hardhat/test/native-core-session.test.cjs', 'scripts/qualification/cleanup-race-oracle.mjs', 'hardhat/test/cleanup-race-oracle.test.cjs', 'GUARD_ORACLE.md'].map(name => [name, sha256(fs.readFileSync(path.join(harnessRoot, name)))])),
    limitations: { localOnly: true, syntheticDelegatedEvidence: true, eip1898AdapterUsed: false, finalizedMappedToLatest: true, publicProviderQualified: false, actualWalletQualified: false, historical6c8DelegateQualified: false, explorerAcceptanceObserved: false, configurationAuthorized: false, activationAuthorized: false, externalIndependentAudit: 'OWNER_ACCEPTED_OMISSION_NOT_PASS', sepolia: 'OWNER_ACCEPTED_OMISSION_NOT_PASS' },
    cases: [], commands: [], operations: [], failures: [], acceptanceComplete: false, nativeCLIQualified: false };
  let bridge, connection, prepared, sequence = 0;
  let cleanupRaceOracle;
  const CLEANUP_RACE_LABEL = 'completion-cleanup-race-preserves-another-session-lock';
  const nextFile = label => path.join(output, 'outputs', `${String(sequence++).padStart(5, '0')}-${label}.json`);
  function scenarioDir(name) { const d = path.join(output, 'scenarios', name); fs.mkdirSync(d, { mode: 0o700 }); return d; }
  async function command(commandName, options, { label = commandName, failure, failureAfterSubmission = false, env = {}, script = path.join(root, 'hardhat/scripts/core-session.cjs'), cwd = root, outputFile } = {}) {
    outputFile ||= nextFile(label);
    const common = { catalog: prepared.catalogPath, 'catalog-sha': prepared.catalogSha256, 'build-id': buildId, out: outputFile };
    const args = [commandName, ...Object.entries({ ...common, ...options }).flatMap(([k, v]) => ['--' + k, String(v)])];
    const before = bridge?.snapshot();
    const existingSession = failure && options.session && fs.existsSync(options.session) && !fs.lstatSync(options.session).isSymbolicLink() ? options.session : null;
    const durableBefore = existingSession ? durableStateDigest(existingSession) : null;
    const locksBefore = failure && options['lock-directory'] ? durableStateDigest(options['lock-directory']) : null;
    const outputBefore = fs.existsSync(outputFile) ? durableStateDigest(outputFile) : null;
    const child = await nativeProcess(script, args, { cwd, env: childEnvironment({ ...(bridge ? { NODE_EXTRA_CA_CERTS: bridge.caFile, MANAGER_READ_RPC_URL: bridge.endpoints.read, MANAGER_RELAY_RPC_URL: bridge.endpoints.relay } : {}), ...env }) });
    const after = bridge?.snapshot(), rawDelta = countRaw(after) - countRaw(before);
    const outputExists = fs.existsSync(outputFile);
    const result = outputExists && !fs.lstatSync(outputFile).isSymbolicLink() ? readJson(outputFile) : null;
    const record = { sequence: report.commands.length, label, executable: process.execPath, executableSha256: report.nodeExecutableSha256, script, scriptSha256: sha256(fs.readFileSync(script)), arguments: args, exitCode: child.code, signal: child.signal, timedOut: child.timedOut, oversized: child.oversized,
      stdoutSha256: sha256(child.stdout), stderrSha256: sha256(child.stderr), output: outputExists && !fs.lstatSync(outputFile).isSymbolicLink() ? { path: outputFile, sha256: sha256(fs.readFileSync(outputFile)), reservedOnly: result?.status === 'RESERVED_BEFORE_ACTION' } : null,
      relayHttpSubmissions: rawDelta, expectedFailure: Boolean(failure), failureBoundary: failure ? 'exact-redacted-cli-error' : null,
      moduleReasonExpectation: failure instanceof RegExp ? String(failure) : null, nativeDiagnosticReasonAsserted: false,
      durableBefore, durableAfter: existingSession ? durableStateDigest(existingSession) : null,
      failureAfterSubmission, stderr: child.stderr.trim() };
    const log = path.join(output, 'commands', String(record.sequence).padStart(5, '0'));
    writeNew(log + '.stdout.txt', child.stdout); writeNew(log + '.stderr.txt', child.stderr); writeNew(log + '.json', record); report.commands.push(record);
    if (commandName !== 'relay') assert.equal(rawDelta, 0, `${label}: read-only command reached raw endpoint`);
    if (commandName === 'relay') assert(rawDelta <= 1, `${label}: native relay resent`);
    if (failure) {
      assertNativeFailure(child, 'core', label);
      assert.equal(rawDelta, failureAfterSubmission ? 1 : 0, `${label}: unexpected raw submission count`);
      if (existingSession && !failureAfterSubmission) {
        // This single named race intentionally preserves its exact command gate.
        // No other negative can opt out of the complete durable-state comparison.
        if (commandName === 'complete' && label === CLEANUP_RACE_LABEL) {
          assert(cleanupRaceOracle && cleanupRaceOracle.session === existingSession);
          cleanupRaceOracle.verifyAfterRejection(durableBefore);
        } else assert.equal(record.durableAfter, durableBefore, `${label}: rejection changed durable session state`);
      }
      if (locksBefore) assert.equal(durableStateDigest(options['lock-directory']), locksBefore, `${label}: rejection changed shared locks`);
      if (outputBefore) assert.equal(durableStateDigest(outputFile), outputBefore, `${label}: rejection replaced existing output`);
      else if (result) assert.equal(result.status, 'RESERVED_BEFORE_ACTION', `${label}: failure published a successful report`);
    }
    else assert.equal(child.code, 0, `${label}: ${child.stderr}`);
    return { result, file: outputFile, record };
  }
  async function caseRun(name, fn, { continueOnFailure = false } = {}) {
    const at = report.commands.length;
    try { const details = await fn(); report.cases.push({ name, status: 'PASS', commands: report.commands.length - at, ...(details || {}) }); }
    catch (error) { report.cases.push({ name, status: 'FAIL', commands: report.commands.length - at, error: error.message }); if (!continueOnFailure) throw error; report.failures.push({ name, message: error.message }); }
  }
  async function sign(handoff, wallet, overrides = {}, label = 'disposable-sign') {
    const child = await nativeProcess(fileURLToPath(import.meta.url), ['--disposable-sign', root], { cwd: root,
      input: JSON.stringify({ privateKey: wallet.privateKey, unsignedSerialized: handoff.unsignedSerialized, overrides }), env: childEnvironment() });
    assert.equal(child.code, 0, `Disposable signer child failed: ${child.stderr}`);
    const signed = JSON.parse(child.stdout), raw = signed.raw;
    const file = path.join(output, 'private', `${String(sequence++).padStart(5, '0')}-${label}.json`); writeNew(file, { raw });
    // Signer stdout and stdin are deliberately not included in uploadable logs.
    report.commands.push({ sequence: report.commands.length, label, executable: process.execPath, executableSha256: report.nodeExecutableSha256, script: fileURLToPath(import.meta.url), arguments: ['--disposable-sign', root], exitCode: child.code, unsignedSha256: sha256(handoff.unsignedSerialized), rawSha256: sha256(raw), rawKeccak256: E.keccak256(raw), privateMaterialExcluded: true });
    return { raw, file, hash: E.keccak256(raw) };
  }
  let rpc;
  async function setup(name, delegated = false) {
    const directory = scenarioDir(name), wallet = E.Wallet.createRandom();
    await rpc('hardhat_setBalance', [wallet.address, E.toQuantity(E.parseEther('10'))]);
    if (delegated) {
      const auth = await wallet.authorize({ address: REGISTRY, chainId: 1, nonce: 0 });
      const [relayer] = await connection.ethers.getSigners();
      const tx = await relayer.sendTransaction({ type: 4, to: relayer.address, authorizationList: [auth], gasLimit: 100000 });
      const receipt = await tx.wait();
      report.fixtureDelegation = { synthetic: true, transactionHash: receipt.hash, blockNumber: receipt.blockNumber, creator: wallet.address, target: REGISTRY, outgoingCoreTransactionType: 2, historical6c8Qualified: false };
    }
    const pinned = await rpc('eth_getBlockByNumber', ['latest', false]);
    const config = initialConfig(E, P, wallet.address, Number(BigInt(await rpc('eth_getTransactionCount', [wallet.address, 'latest']))), { number: Number(BigInt(pinned.number)), hash: pinned.hash });
    if (delegated) {
      const targetCodeHash = E.keccak256(await rpc('eth_getCode', [REGISTRY, 'latest']));
      const kinds = ['consensusEvidenceSha256', 'forkEvidenceSha256', 'delegateReviewSha256'];
      const policy = { mode: A.DELEGATED, delegationCode: '0xef0100' + REGISTRY.slice(2).toLowerCase(), target: REGISTRY, targetCodeHash,
        stateChecks: [{ to: wallet.address, data: new E.Interface(['function marker() view returns(uint256)']).encodeFunctionData('marker'), resultHash: E.keccak256(E.AbiCoder.defaultAbiCoder().encode(['uint256'], [17])) }], qualification: Object.fromEntries(kinds.map(k => [k, '1'.repeat(64)])) };
      const scope = A.qualificationScope(policy, wallet.address, { source, buildId, buildDigest: prepared.buildDigest, catalogSha256: prepared.catalogSha256, block: config.block, executionHardfork: 'osaka' });
      const reports = Object.fromEntries(kinds.map(k => [k, { scope, disposition: 'pass', reviewReference: `SYNTHETIC LOCAL FIXTURE ONLY: ${k}; no public consensus, physical wallet or historical 6c8 review established.` }]));
      policy.qualification = Object.fromEntries(kinds.map(k => [k, T.digest(reports[k])])); config.creatorPolicy = policy; config.qualificationEvidence = { schema: 'manager-delegated-qualification-evidence-v2', scope, reports };
    }
    const configFile = path.join(directory, 'config.json'); writeNew(configFile, config);
    const plan = await command('plan', { config: configFile }, { label: name + '-plan' });
    const session = path.join(directory, 'session'), lockDirectory = path.join(directory, 'locks'); fs.mkdirSync(lockDirectory, { mode: 0o700 });
    return { name, directory, wallet, config, configFile, plan: plan.result, planFile: plan.file, session, lockDirectory };
  }
  const start = x => command('start', { plan: x.planFile, session: x.session, 'lock-directory': x.lockDirectory }, { label: x.name + '-start' });
  const handoff = x => command('handoff', { session: x.session }, { label: x.name + '-handoff' });
  const importSigned = (x, s, options) => command('import', { session: x.session, 'signed-file': s.file }, { label: x.name + '-import', ...options });
  const relay = (x, ack, options) => command('relay', { session: x.session, acknowledgement: ack }, { label: x.name + '-relay', ...options });

  async function exportVerification(x) {
    const destination = path.join(x.directory, 'verification');
    const script = path.join(root, 'hardhat/scripts/export-verification-package.cjs');
    const args = ['--catalog', prepared.catalogPath, '--catalog-sha256', prepared.catalogSha256, '--build-id', buildId, '--plan', x.planFile, '--output', destination, '--source-root', root];
    const before = countRaw(bridge.snapshot());
    const child = await nativeProcess(script, args, { cwd: root });
    assert.equal(child.code, 0, child.stderr); assert.equal(countRaw(bridge.snapshot()), before);
    const manifest = readJson(path.join(destination, 'manifest.json'));
    assert.equal(manifest.receiptProven, false); assert.equal(manifest.explorerAcceptanceObserved, false); assert.equal(manifest.contracts.length, 9);
    report.commands.push({ sequence: report.commands.length, label: x.name + '-verification-export', executable: process.execPath, script, arguments: args, exitCode: child.code, stdoutSha256: sha256(child.stdout), stderrSha256: sha256(child.stderr), manifestSha256: sha256(fs.readFileSync(path.join(destination, 'manifest.json'))) });
  }
  async function positive(delegated) {
    const x = await setup(delegated ? 'delegated-eoa-nine-create' : 'empty-eoa-nine-create', delegated);
    await exportVerification(x); await command('preflight', { plan: x.planFile }, { label: x.name + '-preflight' }); await start(x);
    const relayStart = countRaw(bridge.snapshot());
    for (let i = 0; i < 9; i++) {
      const h = await handoff(x); assert.equal(h.result.index, i);
      const restored = await command('retrieve-handoff', { session: x.session });
      assert.equal(restored.result.unsignedSerialized, h.result.unsignedSerialized); assert.equal(restored.result.newSigningAuthorization, false); assert.equal(restored.result.relayAcknowledgement, null);
      const s = await sign(h.result, x.wallet); const decoded = E.Transaction.from(s.raw);
      assert.equal(decoded.from, x.wallet.address); assert.equal(decoded.to, null); assert.equal(decoded.type, 2); assert.equal(decoded.chainId, 1n); assert.equal(decoded.value, 0n); assert.equal(decoded.nonce, x.plan.startNonce + i);
      assert.deepEqual(T.decodeSigned(s.raw, h.result.envelope).hash, s.hash);
      const imported = await importSigned(x, s);
      const retrieved = await command('retrieve-handoff', { session: x.session }); assert.equal(retrieved.result.relayAcknowledgement, imported.result.relayAcknowledgement);
      const sent = await relay(x, imported.result.relayAcknowledgement); assert.equal(sent.record.relayHttpSubmissions, 1);
      const recovered = await command('recover', { session: x.session }); assert.equal(recovered.result.transactionHash, s.hash); assert.equal(recovered.result.journalModified, false);
      const reconciled = await command('reconcile', { session: x.session }); assert.equal(reconciled.result.index, i);
      report.operations.push({ scenario: x.name, envelope: h.result.envelope, unsignedSha256: sha256(h.result.unsignedSerialized), rawSha256: sha256(s.raw), transactionHash: s.hash, recoveredCreator: decoded.from, proof: recovered.result.proof });
    }
    const completed = await command('complete', { session: x.session });
    assert.equal(completed.result.status, 'CORE_CREATED_PAUSED_CONFIGURATION_SEPARATE'); assert.equal(completed.result.proofs.length, 9); assert.equal(completed.result.activationAuthorized, false); assert.equal(completed.result.configurationAuthorized, false);
    assert.equal(countRaw(bridge.snapshot()) - relayStart, 9); assert.equal(fs.readdirSync(x.lockDirectory).length, 0);
    const contract = new E.Contract(x.plan.operations[8].predictedAddress, prepared.qualified.records.AGIJobManager.artifact.abi, connection.ethers.provider);
    const state = { owner: await contract.owner(), pendingOwner: await contract.pendingOwner(), paused: await contract.paused(), ensJobPages: await contract.ensJobPages(), wallet30: await contract.wallet30(), wallet10: await contract.wallet10(), moderators: await contract.moderators(x.wallet.address), additionalAgents: await contract.additionalAgents(x.wallet.address), additionalValidators: await contract.additionalValidators(x.wallet.address) };
    assert.equal(state.owner, P.GOVERNOR); assert.equal(state.pendingOwner, E.ZeroAddress); assert.equal(state.paused, true); assert.equal(state.ensJobPages, E.ZeroAddress);
    assert.equal(state.wallet30, x.config.constructorArgs.settlementWallets[0]); assert.equal(state.wallet10, x.config.constructorArgs.settlementWallets[1]); for (const k of ['moderators', 'additionalAgents', 'additionalValidators']) assert.equal(state[k], false);
    if (suite === 'full' && !delegated) await completionCases(x);
    return { receipts: 9, state, ownershipEvents: 'OpenZeppelin base constructor emits creator ownership before derived constructor assigns d76; no usable runtime admin window.', configurationTransactions: 0, activationTransactions: 0 };
  }

  async function completionCases(x) {
    const lock = readJson(path.join(x.session, 'session.json')).creatorLock;
    const tombstone = lock.path + '.released-' + lock.token;
    await caseRun('completion-cleans-only-its-own-resurrected-lock', async () => {
      fs.mkdirSync(lock.path); writeNew(path.join(lock.path, 'owner.json'), lock);
      await command('complete', { session: x.session }); assert.equal(fs.existsSync(lock.path), false);
    });
    await caseRun('completion-preserves-foreign-release-tombstone', async () => {
      fs.mkdirSync(tombstone); const other = { ...lock, token: '11111111-2222-4333-8444-555555555555' }; writeNew(path.join(tombstone, 'owner.json'), other);
      await command('complete', { session: x.session }, { failure: /tombstone identity differs/ }); assert.deepEqual(readJson(path.join(tombstone, 'owner.json')), other);
      fs.renameSync(tombstone, path.join(x.directory, 'preserved-foreign-tombstone'));
    });
    await caseRun('completion-recovers-exact-empty-tombstone', async () => { fs.mkdirSync(tombstone); await command('complete', { session: x.session }); assert.equal(fs.existsSync(tombstone), false); });
    // Last subcase: preserve both retained entries in place. Never clean or reuse
    // this session after its guard detects the injected foreign lock arrival.
    await caseRun(CLEANUP_RACE_LABEL, async () => {
      const other = { ...lock, token: '11111111-2222-4333-8444-555555555555', journalPath: path.join(x.directory, 'another-session') };
      cleanupRaceOracle = prepareCleanupRace(x.session, lock.path, other);
      bridge.onceBeforeReply('read', 'eth_chainId', 'another-session-claims-released-creator-lock', () => {
        cleanupRaceOracle.captureBeforeInjection();
        fs.mkdirSync(lock.path); writeNew(path.join(lock.path, 'owner.json'), other);
        cleanupRaceOracle.captureForeignAfterInjection();
      });
      const rejected = await command('complete', { session: x.session }, { label: CLEANUP_RACE_LABEL, failure: /Creator lock membership changed during command/ });
      assert.equal(rejected.result.status, 'RESERVED_BEFORE_ACTION'); assert.equal(rejected.record.relayHttpSubmissions, 0);
      const evidence = cleanupRaceOracle.evidence(); cleanupRaceOracle = undefined;
      return { cleanupRaceOracle: evidence, sessionNotReused: true };
    });
  }

  async function exportPathCases(x, clone) {
    const localScript = path.join(clone, 'hardhat/scripts/export-verification-package.cjs');
    const invoke = async (script, sourceRoot, destination) => {
      const args = ['--catalog', prepared.catalogPath, '--catalog-sha256', prepared.catalogSha256, '--build-id', buildId, '--plan', x.planFile, '--output', destination, '--source-root', sourceRoot];
      const r = await nativeProcess(script, args, { cwd: clone });
      report.commands.push({ sequence: report.commands.length, label: 'export-path-negative', script, arguments: args, exitCode: r.code, stdoutSha256: sha256(r.stdout), stderrSha256: sha256(r.stderr), stderr: r.stderr });
      assertNativeFailure(r, 'export', 'export-path-negative'); return r;
    };
    await caseRun('verification-export-checks-executing-source-root', async () => { const destination = path.join(clone, 'build/export-inside'); await invoke(localScript, root, destination); assert.equal(fs.existsSync(destination), false); });
    await caseRun('verification-export-checks-explicit-observed-source-root', async () => { const destination = path.join(clone, 'build/export-explicit'); await invoke(path.join(root, 'hardhat/scripts/export-verification-package.cjs'), clone, destination); assert.equal(fs.existsSync(destination), false); });
    await caseRun('verification-export-rejects-occupied-directory', async () => { const destination = path.join(x.directory, 'occupied-export'); fs.mkdirSync(destination); writeNew(path.join(destination, 'sentinel'), 'unchanged'); await invoke(localScript, root, destination); assert.deepEqual(fs.readdirSync(destination), ['sentinel']); });
    await caseRun('verification-export-rejects-symlink-parent', async () => { const alias = path.join(x.directory, 'export-alias'); fs.symlinkSync(path.join(output, 'outputs'), alias); const destination = path.join(alias, 'never-exported'); await invoke(localScript, root, destination); assert.equal(fs.existsSync(destination), false); });
  }

  async function timedDriftCases() {
    // Preserve each failure, including an unexpected native success. A test-only
    // reply hook changes private pinned bytes after the child has loaded them.
    for (const kind of ['catalog', 'artifact', 'source']) await caseRun(`native-${kind}-mutation-during-handoff-fails-closed`, async () => {
      const x = await setup('timed-' + kind); await start(x);
      const c = readJson(prepared.catalogPath), directory = path.join(x.directory, 'drift-input'); fs.mkdirSync(directory);
      let mutated;
      if (kind !== 'catalog') {
        const descriptor = kind === 'artifact' ? c.builds[buildId].artifacts.AGIJobManager : Object.values(c.builds[buildId].sources)[0];
        mutated = path.join(directory, 'pinned-' + kind); fs.copyFileSync(descriptor.path, mutated); descriptor.path = mutated;
      }
      const catalog = path.join(directory, 'catalog.json'); writeNew(catalog, c);
      // A new catalog checksum changes plan identity, so use a fresh actual CLI
      // plan/start bound to this catalog; do not substitute a plan in a session.
      const catalogSha = sha256(fs.readFileSync(catalog));
      const plan = await command('plan', { config: x.configFile, catalog, 'catalog-sha': catalogSha });
      const session = path.join(x.directory, 'drift-session'), locks = path.join(x.directory, 'drift-locks'); fs.mkdirSync(locks);
      await command('start', { plan: plan.file, session, 'lock-directory': locks, catalog, 'catalog-sha': catalogSha });
      mutated ||= catalog; const beforeSha = sha256(fs.readFileSync(mutated));
      bridge.onceBeforeReply('read', 'eth_chainId', 'mutate-private-pinned-' + kind + '-after-native-load', () => fs.appendFileSync(mutated, '\n'));
      const result = await command('handoff', { session, catalog, 'catalog-sha': catalogSha }, { failure: /Pinned source\/build file drift|checksum mismatch/ });
      assert.notEqual(sha256(fs.readFileSync(mutated)), beforeSha); assert.equal(result.result?.status, 'RESERVED_BEFORE_ACTION');
      const events = fs.readdirSync(path.join(session, 'events')); assert.equal(events.length, 1, 'Drift authorized a durable signing handoff');
    }, { continueOnFailure: true });
  }

  async function sourceCases() {
    const clone = path.join(output, 'source-probes', 'actual-checkpoint');
    fs.mkdirSync(clone, { mode: 0o700 }); cleanGit(clone, 'init', '--quiet');
    const objects = cleanGit(root, 'rev-parse', '--git-path', 'objects');
    fs.mkdirSync(path.join(clone, '.git/objects/info'), { recursive: true });
    fs.writeFileSync(path.join(clone, '.git/objects/info/alternates'), path.resolve(root, objects) + '\n');
    cleanGit(clone, 'update-ref', 'HEAD', expectedCommit); cleanGit(clone, 'read-tree', expectedCommit);
    // Link immutable reviewed bytes rather than copy the full tree. Every file
    // intentionally mutated below is detached before any write/chmod operation.
    const tracked = cleanGit(root, 'ls-tree', '-r', '--name-only', expectedCommit).split('\n');
    for (const relative of tracked) {
      const from = path.join(root, relative), into = path.join(clone, relative);
      fs.mkdirSync(path.dirname(into), { recursive: true });
      if (fs.lstatSync(from).isSymbolicLink()) fs.symlinkSync(fs.readlinkSync(from), into); else fs.linkSync(from, into);
    }
    for (const relative of ['README.md', 'package-lock.json']) { const file = path.join(clone, relative), bytes = fs.readFileSync(file), mode = fs.statSync(file).mode; fs.unlinkSync(file); fs.writeFileSync(file, bytes, { mode }); }
    // Ignored real directory with entry symlinks preserves exact observed identity.
    for (const relative of ['node_modules', 'hardhat/node_modules']) {
      const target = path.join(root, relative); if (!fs.existsSync(target)) continue;
      const into = path.join(clone, relative); fs.mkdirSync(into, { recursive: true });
      for (const name of fs.readdirSync(target)) fs.symlinkSync(path.join(target, name), path.join(into, name));
    }
    assert.deepEqual(observeSource(clone, expectedCommit, expectedTree), source);
    const script = path.join(clone, 'hardhat/scripts/core-session.cjs');
    const config = initialConfig(E, P, E.Wallet.createRandom().address, 0, { number: 1, hash: '0x' + '12'.repeat(32) });
    const configFile = path.join(output, 'source-probes', 'config.json'); writeNew(configFile, config);
    const probe = (name, failure, env) => command('plan', { config: configFile }, { label: name, failure, env, script, cwd: clone });
    const file = path.join(clone, 'README.md'), original = fs.readFileSync(file), mode = fs.statSync(file).mode;
    const alter = async (name, before, after, pattern) => caseRun(name, async () => { before(); try { assert.throws(() => P.observedRevision(clone), pattern); await probe(name, pattern); } finally { after(); } });
    await alter('dirty-source-rejected', () => fs.appendFileSync(file, '\nfixture drift\n'), () => fs.writeFileSync(file, original), /Tracked source bytes/);
    await alter('staged-source-rejected', () => { fs.appendFileSync(file, '\nfixture drift\n'); cleanGit(clone, 'add', 'README.md'); }, () => { fs.writeFileSync(file, original); cleanGit(clone, 'read-tree', expectedCommit); }, /index differs/);
    const untracked = path.join(clone, 'NATIVE_UNTRACKED_PROBE.txt');
    await alter('untracked-source-rejected', () => fs.writeFileSync(untracked, 'fixture'), () => fs.unlinkSync(untracked), /untracked files/);
    for (const flag of ['assume-unchanged', 'skip-worktree']) await alter(`${flag}-rejected`, () => cleanGit(clone, 'update-index', '--' + flag, 'README.md'), () => cleanGit(clone, 'update-index', '--no-' + flag, 'README.md'), /assume-unchanged or skip-worktree/);
    await alter('executable-mode-rejected', () => fs.chmodSync(file, mode ^ 0o100), () => fs.chmodSync(file, mode), /executable mode/);
    await alter('tracked-symlink-substitution-rejected', () => { fs.unlinkSync(file); fs.symlinkSync(path.join(root, 'README.md'), file); }, () => { fs.unlinkSync(file); fs.writeFileSync(file, original, { mode }); }, /source type/);
    const lock = path.join(clone, 'package-lock.json'), lockBytes = fs.readFileSync(lock);
    await alter('changed-root-lock-rejected', () => fs.appendFileSync(lock, '\n'), () => fs.writeFileSync(lock, lockBytes), /Tracked source bytes/);
    await caseRun('inherited-git-redirection-is-ignored', async () => { await probe('git-environment', undefined, { GIT_DIR: '/does/not/exist', GIT_WORK_TREE: '/does/not/exist', GIT_INDEX_FILE: '/does/not/exist', GIT_CONFIG_COUNT: '1', GIT_CONFIG_KEY_0: 'core.worktree', GIT_CONFIG_VALUE_0: '/does/not/exist' }); });
    await caseRun('git-clean-filter-is-never-executed', async () => {
      const sentinel = path.join(output, 'source-probes', 'FILTER_EXECUTED');
      cleanGit(clone, 'config', 'filter.nativefixture.clean', `touch ${sentinel}`); cleanGit(clone, 'config', 'filter.nativefixture.required', 'true');
      const attributes = path.join(clone, '.git/info/attributes'); fs.writeFileSync(attributes, 'README.md filter=nativefixture\n');
      try { await probe('filter-not-executed'); assert.equal(fs.existsSync(sentinel), false); }
      finally { fs.unlinkSync(attributes); cleanGit(clone, 'config', '--remove-section', 'filter.nativefixture'); }
    });
    for (const field of ['commit', 'tree', 'rootLockSha256', 'hardhatLockSha256']) await caseRun(`wrong-catalog-${field}-rejected`, async () => {
      const c = readJson(prepared.catalogPath); c.builds[buildId].source[field] = 'f'.repeat(field.endsWith('Sha256') ? 64 : 40);
      const file = path.join(output, 'source-probes', field + '-catalog.json'); writeNew(file, c);
      assert.throws(() => C.loadQualifiedBuild({ catalogPath: file, catalogSha256: sha256(fs.readFileSync(file)), buildId, expectedRevision: source }), /Independently observed source/);
      await command('plan', { config: configFile, catalog: file, 'catalog-sha': sha256(fs.readFileSync(file)) }, { label: 'wrong-' + field, failure: /Independently observed source/ });
    });
    await caseRun('missing-build-id-rejected', async () => { assert.throws(() => C.loadQualifiedBuild({ catalogPath: prepared.catalogPath, catalogSha256: prepared.catalogSha256, buildId: 'missing-actual-build', expectedRevision: source }), /absent/); await command('plan', { config: configFile, 'build-id': 'missing-actual-build' }, { failure: /absent/ }); });
    await caseRun('catalog-checksum-drift-rejected', async () => { assert.throws(() => C.loadQualifiedBuild({ catalogPath: prepared.catalogPath, catalogSha256: '1'.repeat(64), buildId, expectedRevision: source }), /checksum mismatch/); await command('plan', { config: configFile, 'catalog-sha': '1'.repeat(64) }, { failure: /checksum mismatch/ }); });
    for (const field of ['input', 'output']) await caseRun(`compiler-${field}-drift-rejected`, async () => {
      const c = readJson(prepared.catalogPath), original = c.builds[buildId][field];
      const file = path.join(output, 'source-probes', field + '.json'); fs.copyFileSync(original.path, file); fs.appendFileSync(file, '\n'); c.builds[buildId][field].path = file;
      const cf = path.join(output, 'source-probes', field + '-catalog.json'); writeNew(cf, c);
      assert.throws(() => C.loadQualifiedBuild({ catalogPath: cf, catalogSha256: sha256(fs.readFileSync(cf)), buildId, expectedRevision: source }), /checksum mismatch/);
      await command('plan', { config: configFile, catalog: cf, 'catalog-sha': sha256(fs.readFileSync(cf)) }, { failure: /checksum mismatch/ });
    });
    await caseRun('seven-argument-artifacts-cannot-be-relabeled-historical', async () => {
      const c = readJson(prepared.catalogPath); c.builds[buildId].artifacts.AGIJobManager.constructorSchema = C.CONSTRUCTOR_SCHEMAS.legacy;
      const file = path.join(output, 'source-probes', 'relabel-catalog.json'); writeNew(file, c);
      assert.throws(() => C.loadQualifiedBuild({ catalogPath: file, catalogSha256: sha256(fs.readFileSync(file)), buildId, expectedRevision: source }), /constructor schema mismatch/);
      await command('plan', { config: configFile, catalog: file, 'catalog-sha': sha256(fs.readFileSync(file)) }, { failure: /constructor schema mismatch/ });
    });
    for (const kind of ['source', 'artifact']) await caseRun(`pinned-${kind}-changed-after-load-rejected`, async () => {
      // Existing catalog authority gets a private exact byte copy, then detects its
      // drift. This supplements (and is never reported as) a native CLI success.
      const c = readJson(prepared.catalogPath), d = kind === 'source' ? Object.values(c.builds[buildId].sources)[0] : c.builds[buildId].artifacts.AGIJobManager;
      const file = path.join(output, 'source-probes', kind + '-after-load'); fs.copyFileSync(d.path, file); d.path = file;
      const cf = path.join(output, 'source-probes', kind + '-after-load-catalog.json'); writeNew(cf, c);
      const loaded = C.loadQualifiedBuild({ catalogPath: cf, catalogSha256: sha256(fs.readFileSync(cf)), buildId, expectedRevision: source }); fs.appendFileSync(file, '\n'); assert.throws(() => loaded.assertUnchanged(), /Pinned source\/build file drift/);
      return { boundary: 'supplemental-catalog-API-negative-only' };
    });
    assert.deepEqual(observeSource(clone, expectedCommit, expectedTree), source);
    if (legacy) await historicalCatalogCases(configFile);
  }

  async function historicalCatalogCases(configFile) {
    await caseRun('authentic-six-argument-catalog-remains-separate-and-rejected', async () => {
      for (const k of ['commit', 'tree']) assert.match(legacy[k], /^[a-f0-9]{40}$/);
      assert.equal(cleanGit(root, 'rev-parse', legacy.commit + '^{tree}'), legacy.tree);
      const legacyRoot = fs.realpathSync(legacy.sourceRoot), artifactsRoot = fs.realpathSync(legacy.artifactsRoot);
      const entries = cleanGit(root, 'ls-tree', '-r', '--full-tree', legacy.commit).split('\n');
      for (const entry of entries) {
        const m = /^([0-7]{6}) blob ([a-f0-9]{40})\t(.+)$/.exec(entry); assert(m, 'Unsupported historical tree entry');
        const [, mode, expected, name] = m, file = path.join(legacyRoot, name), stat = fs.lstatSync(file);
        assert(['100644', '100755', '120000'].includes(mode));
        const bytes = mode === '120000' ? Buffer.from(fs.readlinkSync(file)) : fs.readFileSync(file);
        if (mode !== '120000') { assert(stat.isFile() && !stat.isSymbolicLink()); assert.equal(Boolean(stat.mode & 0o100), mode === '100755'); }
        assert.equal(crypto.createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex'), expected, `Historical source drift: ${name}`);
      }
      const oldSource = { commit: legacy.commit, tree: legacy.tree, rootLockSha256: sha256(fs.readFileSync(path.join(legacyRoot, 'package-lock.json'))), hardhatLockSha256: sha256(fs.readFileSync(path.join(legacyRoot, 'hardhat/package-lock.json'))) };
      const descriptor = file => ({ path: fs.realpathSync(file), sha256: sha256(fs.readFileSync(file)) });
      const manager = readJson(path.join(artifactsRoot, 'contracts/AGIJobManager.sol/AGIJobManager.json'));
      assert.equal(manager.abi.find(x => x.type === 'constructor').inputs.length, 6);
      const inputPath = path.join(artifactsRoot, 'build-info', manager.buildInfoId + '.json'), outputPath = path.join(artifactsRoot, 'build-info', manager.buildInfoId + '.output.json'), input = readJson(inputPath);
      const dependencyRoot = path.resolve(artifactsRoot, '../../node_modules/@openzeppelin/contracts');
      const sources = {};
      for (const [name, content] of Object.entries(input.input.sources)) {
        let file; if (name.startsWith('project/')) file = path.join(legacyRoot, name.slice(8)); else if (name.startsWith('npm/@openzeppelin/contracts@4.9.6/')) file = path.join(dependencyRoot, name.slice('npm/@openzeppelin/contracts@4.9.6/'.length)); else throw Error('Unreviewed historical compiler source resolver.');
        assert(fs.readFileSync(file).equals(Buffer.from(content.content))); sources[name] = descriptor(file);
      }
      const { FQNS } = require(path.join(root, 'hardhat/scripts/deploy.cjs'));
      const artifacts = Object.fromEntries(C.CORE_NAMES.map(name => { const file = path.join(artifactsRoot, FQNS[name].replace(':', '/') + '.json'); assert.equal(readJson(file).buildInfoId, manager.buildInfoId); return [name, { ...descriptor(file), fqn: FQNS[name], constructorSchema: name === 'AGIJobManager' ? C.CONSTRUCTOR_SCHEMAS.legacy : C.CONSTRUCTOR_SCHEMAS.library }]; }));
      const oldId = 'authentic-six-argument-' + legacy.commit.slice(0, 12), file = path.join(output, 'source-probes', 'historical-catalog.json');
      const catalog = { schema: C.CATALOG_SCHEMA, builds: { [oldId]: { source: oldSource, compiler: { version: input.solcVersion, longVersion: input.solcLongVersion }, input: descriptor(inputPath), output: descriptor(outputPath), sources, artifacts } } }; writeNew(file, catalog);
      const catalogSha = sha256(fs.readFileSync(file)), qualified = C.loadQualifiedBuild({ catalogPath: file, catalogSha256: catalogSha, buildId: oldId, expectedRevision: oldSource });
      assert.equal(qualified.records.AGIJobManager.constructorSchema, C.CONSTRUCTOR_SCHEMAS.legacy);
      assert.throws(() => P.makePlan(readJson(configFile), qualified, oldSource), /constructor schema differs/);
      assert.throws(() => C.loadQualifiedBuild({ catalogPath: file, catalogSha256: catalogSha, buildId: oldId, expectedRevision: source }), /Independently observed source/);
      await command('plan', { config: configFile, catalog: file, 'catalog-sha': catalogSha, 'build-id': oldId }, { failure: /Independently observed source/ });
      report.historicalCatalog = { source: oldSource, sourceTreeEntriesVerified: entries.length, compilerSourcesVerified: Object.keys(sources).length, constructorArguments: 6, compilerBuildInfoId: manager.buildInfoId, catalogSha256: catalogSha, inputSha256: qualified.inputSha256, outputSha256: qualified.outputSha256, nativeRejection: 'cross-generation-source-mismatch', supplementalPlannerRejection: 'actual-six-argument-constructor-schema', archivedTreeVerifiedNotNativeCheckout: true };
    });
  }

  async function negativeCases() {
    const x = await setup('negative-envelope-and-paths');
    // All forbidden paths are probed in the private exact-checkpoint clone, never
    // by writing to the reviewed target source tree.
    const clone = path.join(output, 'source-probes', 'actual-checkpoint'), cloneScript = path.join(clone, 'hardhat/scripts/core-session.cjs');
    await caseRun('in-checkout-output-rejected-before-creation', async () => {
      const inside = path.join(clone, 'build/native-forbidden.json'); fs.mkdirSync(path.dirname(inside), { recursive: true });
      await command('plan', { config: x.configFile, out: inside }, { outputFile: inside, script: cloneScript, cwd: clone, failure: /outside the reviewed source/ }); assert.equal(fs.existsSync(inside), false);
    });
    for (const kind of ['session', 'lock-directory']) await caseRun(`in-checkout-${kind}-rejected`, async () => {
      const inside = path.join(clone, 'build', kind), options = { plan: x.planFile, session: x.session, 'lock-directory': x.lockDirectory, [kind]: inside };
      await command('start', options, { script: cloneScript, cwd: clone, failure: /outside the reviewed source/ }); assert.equal(fs.existsSync(inside), false);
    });
    await caseRun('occupied-output-is-not-overwritten', async () => { const file = path.join(x.directory, 'occupied.json'); writeNew(file, { sentinel: true }); const digest = sha256(fs.readFileSync(file)); await command('plan', { config: x.configFile, out: file }, { outputFile: file, failure: /EEXIST/ }); assert.equal(sha256(fs.readFileSync(file)), digest); });
    await caseRun('symlink-output-parent-rejected', async () => { const alias = path.join(x.directory, 'alias'); fs.symlinkSync(path.join(output, 'outputs'), alias); const file = path.join(alias, 'not-created.json'); await command('plan', { config: x.configFile, out: file }, { outputFile: file, failure: /symlinks/ }); assert.equal(fs.existsSync(file), false); });
    for (const dangling of [false, true]) await caseRun(`${dangling ? 'dangling-' : ''}final-symlink-rejected`, async () => { const file = path.join(x.directory, `symlink-${dangling}.json`); fs.symlinkSync(dangling ? path.join(x.directory, 'absent') : x.configFile, file); await command('plan', { config: x.configFile, out: file }, { outputFile: file, failure: /symlink/ }); });
    await caseRun('traversal-alias-into-source-rejected', async () => { const file = path.join(clone, 'build') + '/../build/never.json'; await command('plan', { config: x.configFile, out: file }, { outputFile: file, script: cloneScript, cwd: clone, failure: /outside/ }); });
    await start(x); const h = await handoff(x);
    const variants = { sender: { wallet: E.Wallet.createRandom() }, signature: { corrupt: true }, chain: { chainId: 2 }, type: { type: 1, gasPrice: '10000000000', maxFeePerGas: null, maxPriorityFeePerGas: null }, nonce: { nonce: h.result.envelope.nonce + 1 }, destination: { to: REGISTRY }, calldata: { data: '0x00' }, gas: { gasLimit: '53001' }, maxFee: { maxFeePerGas: '11000000000' }, priorityFee: { maxPriorityFeePerGas: '2000000000' }, value: { value: '1' }, accessList: { accessList: [{ address: REGISTRY, storageKeys: [] }] }, type4: { type: 4, to: REGISTRY, authorizationList: [] } };
    for (const [name, variant] of Object.entries(variants)) await caseRun(`wrong-raw-${name}-rejected`, async () => {
      let signed;
      if (variant.corrupt) { signed = { file: path.join(output, 'private', 'corrupt-raw.json') }; writeNew(signed.file, { raw: '0x02' }); }
      else signed = await sign(h.result, variant.wallet || x.wallet, variant.wallet ? {} : variant, 'wrong-' + name);
      assert.throws(() => T.decodeSigned(readJson(signed.file).raw, h.result.envelope), /signed|Signed|canonical|payload|sender/i);
      await importSigned(x, signed, { failure: /signed|Signed|canonical|payload|sender/i });
    });
    await caseRun('factory-batch-wrapped-policies-rejected', async () => {
      for (const mode of ['factory', 'batch', 'wrapped']) { const config = structuredClone(x.config); config.creatorPolicy = { mode }; const file = path.join(x.directory, mode + '.json'); writeNew(file, config); assert.throws(() => P.makePlan(config, prepared.qualified, source), /fields|policy/i); await command('plan', { config: file }, { failure: /fields|policy/i }); }
    });
    await caseRun('gas-cap-plus-one-rejected-offline', async () => { const c = structuredClone(x.config); c.envelopes[0].gasLimit = '16777217'; const file = path.join(x.directory, 'gas-cap.json'); writeNew(file, c); assert.throws(() => P.makePlan(c, prepared.qualified, source), /gas|fee/i); await command('plan', { config: file }, { failure: /gas|fee/i }); });
    await caseRun('lost-handoff-output-is-retrievable-without-new-authorization', async () => { const restored = await command('retrieve-handoff', { session: x.session }); assert.equal(restored.result.unsignedSerialized, h.result.unsignedSerialized); assert.equal(restored.result.newSigningAuthorization, false); await command('handoff', { session: x.session }, { failure: /already handed/ }); });
    const signed = await sign(h.result, x.wallet), imported = await importSigned(x, signed);
    await caseRun('lost-import-output-restores-exact-acknowledgement-only-in-signed-state', async () => { const r = await command('retrieve-handoff', { session: x.session }); assert.equal(r.result.relayAcknowledgement, imported.result.relayAcknowledgement); assert.equal(r.result.newSigningAuthorization, false); });
    await caseRun('accept-then-drop-keeps-attempt-marker-never-resends-recovers', async () => {
      bridge.inject('relay', { kind: 'accept-drop' }); const before = countRaw(bridge.snapshot());
      const failed = await relay(x, imported.result.relayAcknowledgement, { failure: /ambiguous or rejected/, failureAfterSubmission: true }); assert.equal(failed.result.status, 'RESERVED_BEFORE_ACTION');
      assert.equal(readJson(path.join(x.session, 'attempts/0.json')).transactionHash, signed.hash);
      const r = await command('retrieve-handoff', { session: x.session }); assert.equal(r.result.relayAcknowledgement, null); assert.equal(r.result.relayAlreadyAttempted, true);
      await relay(x, imported.result.relayAcknowledgement, { failure: /already attempted/ }); assert.equal(countRaw(bridge.snapshot()) - before, 1);
      const recovered = await command('recover', { session: x.session }); assert.equal(recovered.result.transactionHash, signed.hash); assert.equal(recovered.result.journalModified, false); await command('reconcile', { session: x.session });
    });
    await caseRun('hashless-external-broadcast-recovered-by-canonical-sender-nonce', async () => {
      const x = await setup('hashless'); await start(x); const h = await handoff(x), signed = await sign(h.result, x.wallet);
      await rpc('eth_sendRawTransaction', [signed.raw]); report.externalFixtureBroadcasts = (report.externalFixtureBroadcasts || 0) + 1;
      const before = fs.readdirSync(path.join(x.session, 'events')).length, r = await command('recover', { session: x.session }); assert.equal(r.result.transactionHash, signed.hash); assert.equal(fs.readdirSync(path.join(x.session, 'events')).length, before); await command('reconcile', { session: x.session });
    });
    await exportPathCases(x, clone); await transportCases(); await stateCases(); await journalCases(); await timedDriftCases();
  }

  async function transportCases() {
    const x = await setup('read-http-failures');
    for (const kind of ['malformed', 'redirect', 'oversized', 'timeout', 'error', 'wrong-id']) await caseRun(`native-read-${kind}-fails-closed`, async () => { const before = bridge.snapshot().requests.length; bridge.inject('read', { kind }); await command('preflight', { plan: x.planFile }, { failure: /RPC request failed/ }); assert.equal(bridge.snapshot().requests.length - before, 1); });
    for (const kind of ['malformed', 'redirect', 'oversized', 'timeout', 'error', 'wrong-id']) await caseRun(`native-relay-${kind}-no-retry`, async () => {
      const x = await setup('relay-http-' + kind); await start(x); const h = await handoff(x), s = await sign(h.result, x.wallet), imported = await importSigned(x, s), before = countRaw(bridge.snapshot());
      bridge.inject('relay', { kind }); await relay(x, imported.result.relayAcknowledgement, { failure: /ambiguous or rejected/, failureAfterSubmission: true }); await relay(x, imported.result.relayAcknowledgement, { failure: /already attempted/ });
      assert.equal(countRaw(bridge.snapshot()) - before, 1); assert.equal(readJson(path.join(x.session, 'attempts/0.json')).transactionHash, s.hash);
    });
  }

  async function stateCases() {
    const x = await setup('state-drift'); await start(x);
    await caseRun('shared-creator-lock-prevents-optional-reservation', async () => {
      const script = path.join(output, 'private', 'optional-reservation-probe.cjs');
      writeNew(script, `const C=require(process.argv[2]);try{C.reserveCreator({directory:process.argv[3],chainId:1,creator:process.argv[4],journalPath:process.argv[5]});process.exitCode=0;}catch(e){console.error(e.message);process.exitCode=1;}\n`);
      const args = [path.join(root, 'hardhat/scripts/creator-transaction.cjs'), x.lockDirectory, x.wallet.address, path.join(x.directory, 'optional-journal')];
      const child = await nativeProcess(script, args, { cwd: root }); assert.notEqual(child.code, 0); assert.match(child.stderr, /nonce lock already exists/);
      report.commands.push({ sequence: report.commands.length, label: 'optional-shared-reservation-probe', script, arguments: args, exitCode: child.code, stderr: child.stderr, boundary: 'shared-lock-only-no-optional-deployment' });
      const z = await setup('optional-existing-lock');
      const created = await nativeProcess(script, [args[0], z.lockDirectory, z.wallet.address, path.join(z.directory, 'optional-journal')], { cwd: root }); assert.equal(created.code, 0);
      await command('start', { plan: z.planFile, session: z.session, 'lock-directory': z.lockDirectory }, { failure: /nonce lock already exists/ });
    });
    await caseRun('shared-creator-lock-prevents-overlapping-core-session', () => command('start', { plan: x.planFile, session: path.join(x.directory, 'overlap'), 'lock-directory': x.lockDirectory }, { failure: /nonce lock already exists/ }));
    await caseRun('occupied-prediction-stops-before-handoff', async () => { const at = x.plan.operations[0].predictedAddress; await rpc('hardhat_setCode', [at, '0x00']); try { await command('handoff', { session: x.session }, { failure: /already occupied/ }); } finally { await rpc('hardhat_setCode', [at, '0x']); } });
    await caseRun('changed-governor-stops-before-handoff', async () => { await rpc('hardhat_setCode', [P.GOVERNOR, '0x00']); try { await command('handoff', { session: x.session }, { failure: /governor has unexpected code/ }); } finally { await rpc('hardhat_setCode', [P.GOVERNOR, '0x']); } });
    await caseRun('changed-creator-code-stops-before-handoff', async () => { await rpc('hardhat_setCode', [x.wallet.address, '0x00']); try { await command('handoff', { session: x.session }, { failure: /Empty-code EOA/ }); } finally { await rpc('hardhat_setCode', [x.wallet.address, '0x']); } });
    await caseRun('pending-nonce-drift-stops-before-handoff', async () => { await rpc('hardhat_setNonce', [x.wallet.address, '0x5']); await command('handoff', { session: x.session }, { failure: /nonce drift/ }); });
    const d = await setup('delegated-state-drift', true); await start(d);
    await caseRun('changed-delegate-runtime-stops-before-handoff', async () => { const old = await rpc('eth_getCode', [REGISTRY, 'latest']); await rpc('hardhat_setCode', [REGISTRY, '0x00']); try { await command('handoff', { session: d.session }, { failure: /target runtime changed/ }); } finally { await rpc('hardhat_setCode', [REGISTRY, old]); } });
    await caseRun('changed-delegate-state-stops-before-handoff', async () => { await rpc('hardhat_setStorageAt', [d.wallet.address, '0x0', E.zeroPadValue('0x2a', 32)]); try { await command('handoff', { session: d.session }, { failure: /authority state changed/ }); } finally { await rpc('hardhat_setStorageAt', [d.wallet.address, '0x0', E.ZeroHash]); } });
    await caseRun('changed-delegation-indicator-stops-before-handoff', async () => { const original = await rpc('eth_getCode', [d.wallet.address, 'latest']); await rpc('hardhat_setCode', [d.wallet.address, '0x']); try { await command('handoff', { session: d.session }, { failure: /delegation indicator changed/ }); } finally { await rpc('hardhat_setCode', [d.wallet.address, original]); } });
    await caseRun('pending-nonce-drift-stops-before-relay-without-attempt', async () => { const z = await setup('relay-nonce-drift'); await start(z); const h = await handoff(z), s = await sign(h.result, z.wallet), i = await importSigned(z, s); await rpc('hardhat_setNonce', [z.wallet.address, '0x5']); await relay(z, i.result.relayAcknowledgement, { failure: /nonce drift/ }); assert.deepEqual(fs.readdirSync(path.join(z.session, 'attempts')), []); });
    await caseRun('stale-plan-stops-before-handoff', async () => { const x = await setup('stale-plan'); await start(x); await rpc('hardhat_mine', ['0x801']); await command('handoff', { session: x.session }, { failure: /validity expired/ }); });
  }

  async function journalCases() {
    const x = await setup('journal-interruptions'); await start(x);
    const initialHead = fs.readFileSync(path.join(x.session, 'head.json')), h = await handoff(x);
    await caseRun('exact-one-event-head-lag-repair-requires-ack', async () => {
      fs.writeFileSync(path.join(x.session, 'head.json'), initialHead);
      await command('retrieve-handoff', { session: x.session }, { failure: /Journal\/head mismatch/ });
      const inspected = await command('inspect-journal', { session: x.session }); assert.equal(inspected.result.headRepairRequired, true);
      await command('repair-journal', { session: x.session, acknowledgement: 'wrong' }, { failure: /acknowledgement/ });
      await command('repair-journal', { session: x.session, acknowledgement: inspected.result.acknowledgement });
      await command('handoff', { session: x.session }, { failure: /already handed/ });
    });
    const eventDir = path.join(x.session, 'events'), event = path.join(eventDir, '000001.json'), bytes = fs.readFileSync(event);
    for (const mode of ['missing', 'truncated', 'reordered']) await caseRun(`${mode}-journal-fails-closed`, async () => {
      if (mode === 'missing') fs.unlinkSync(event); else if (mode === 'truncated') fs.writeFileSync(event, bytes.subarray(0, 10)); else fs.renameSync(event, path.join(eventDir, '000002.json'));
      try { await command('retrieve-handoff', { session: x.session }, { failure: /mismatch|JSON|sequence|property|Unexpected/i }); }
      finally { if (mode === 'reordered') fs.renameSync(path.join(eventDir, '000002.json'), event); else fs.writeFileSync(event, bytes); }
    });
    const s = await sign(h.result, x.wallet), imported = await importSigned(x, s);
    await caseRun('altered-signed-capability-fails-closed', async () => { const file = path.join(x.session, 'signed/0.json'), original = fs.readFileSync(file); fs.writeFileSync(file, JSON.stringify({ raw: '0x02' })); try { await command('retrieve-handoff', { session: x.session }, { failure: /signed|canonical/i }); } finally { fs.writeFileSync(file, original); } });
    const checkTail = status => caseRun(`${status}-tail-deletion-fails-closed`, async () => { const last = path.join(eventDir, fs.readdirSync(eventDir).sort().at(-1)), original = fs.readFileSync(last); fs.unlinkSync(last); try { await command('retrieve-handoff', { session: x.session }, { failure: /Journal\/head mismatch/ }); } finally { fs.writeFileSync(last, original); } });
    await checkTail('signed'); await relay(x, imported.result.relayAcknowledgement); await checkTail('attempted');
    await caseRun('stale-command-lock-retained-read-only-recovery-works', async () => { const lock = path.join(x.session, 'active-command'); fs.mkdirSync(lock); await command('reconcile', { session: x.session }, { failure: /active or crashed/ }); const r = await command('recover', { session: x.session }); assert.equal(r.result.transactionHash, s.hash); assert.equal(fs.existsSync(lock), true); fs.rmdirSync(lock); });
    await command('reconcile', { session: x.session }); await checkTail('finalized');
    const z = await setup('independent-marker'); await start(z); const zh = await handoff(z), zs = await sign(zh.result, z.wallet), zi = await importSigned(z, zs);
    await caseRun('independent-attempt-marker-never-restores-ack-or-resends', async () => { writeNew(path.join(z.session, 'attempts/0.json'), {}); const r = await command('retrieve-handoff', { session: z.session }); assert.equal(r.result.relayAcknowledgement, null); assert.equal(r.result.relayAlreadyAttempted, true); await relay(z, zi.result.relayAcknowledgement, { failure: /EEXIST/ }); });
    await caseRun('transplanted-lock-rejected-before-write', async () => { const metaPath = path.join(z.session, 'session.json'), meta = readJson(metaPath), old = fs.readFileSync(metaPath); meta.creatorLock.creator = E.Wallet.createRandom().address; fs.writeFileSync(metaPath, JSON.stringify(meta)); try { await command('import', { session: z.session, 'signed-file': zs.file }, { failure: /bound to the plan/ }); } finally { fs.writeFileSync(metaPath, old); } });
  }

  try {
    report.nodeExecutableSha256 = sha256(fs.readFileSync(process.execPath));
    prepared = prepareCoreCatalog({ sourceRoot: root, outputDirectory: path.join(output, 'catalog'), expectedCommit, expectedTree, buildId });
    const { qualified, ...catalogMetadata } = prepared; report.build = catalogMetadata;
    if (suite === 'full' || suite === 'source') await sourceCases();
    if (suite !== 'source') {
      // A fresh EDR network with explicit normal Osaka limits. No HTTP provider,
      // coverage override, existing chain or signer credential is selected.
      const { createHardhatRuntimeEnvironment } = await import(pathToFileURL(require.resolve('hardhat/hre')).href);
      const { default: ethersPlugin } = await import(pathToFileURL(require.resolve('@nomicfoundation/hardhat-ethers', { paths: [path.join(root, 'hardhat')] })).href);
      const hre = await createHardhatRuntimeEnvironment({ plugins: [ethersPlugin],
        paths: { sources: path.join(root, 'contracts'), artifacts: path.join(root, 'hardhat/artifacts'), cache: path.join(output, 'private/cache') },
        networks: { hardhat: { type: 'edr-simulated', chainType: 'l1', chainId: 1, hardfork: 'osaka', blockGasLimit: 30000000, allowUnlimitedContractSize: false,
          accounts: { mnemonic: 'test test test test test test test test test test test junk', count: 2 } } },
      }, {}, root);
      connection = await hre.network.create('hardhat');
      assert.equal(connection.networkConfig.type, 'edr-simulated'); assert.equal(connection.networkConfig.hardfork, 'osaka'); assert.equal(connection.networkConfig.allowUnlimitedContractSize, false); assert.equal(connection.networkConfig.blockGasLimit, 30000000n);
      rpc = (method, params) => connection.provider.request({ method, params });
      assert.equal(await rpc('eth_chainId', []), '0x1'); assert.equal(BigInt((await rpc('eth_getBlockByNumber', ['latest', false])).gasLimit), 30000000n);
      report.chain = { type: 'disposable-edr', chainId: 1, hardfork: 'osaka', blockGasLimit: '30000000', eip170Enforced: true, coverageBypass: false };
      const compiled = JSON.parse(require('solc').compile(JSON.stringify({ language: 'Solidity', sources: { 'NativeFixture.sol': { content: 'pragma solidity ^0.8.20; contract Fixture { function decimals() external pure returns(uint8){return 6;} function paused() external pure returns(bool){return false;} function isBlacklisted(address) external pure returns(bool){return false;} function marker() external view returns(uint){uint x; assembly { x := sload(0) } return x == 0 ? 17 : x;} }' } }, settings: { evmVersion: 'shanghai', outputSelection: { '*': { '*': ['evm.deployedBytecode.object'] } } } })));
      assert(!compiled.errors?.some(e => e.severity === 'error'));
      const code = '0x' + compiled.contracts['NativeFixture.sol'].Fixture.evm.deployedBytecode.object;
      for (const address of [USDC, REGISTRY]) await rpc('hardhat_setCode', [address, code]); await rpc('hardhat_mine', ['0x1']);
      bridge = await createNativeCoreRpc({ rpc, directory: path.join(output, 'private', 'tls') });
      report.transport = { readEndpoint: bridge.endpoints.read, relayEndpoint: bridge.endpoints.relay, childOnlyCaSha256: bridge.caSha256, normalTlsVerification: true };
      await caseRun('empty-eoa-nine-native-create-completion', () => positive(false));
      await caseRun('synthetic-delegated-eoa-nine-native-create-completion', () => positive(true));
      if (suite === 'full') await negativeCases();
    }
    prepared.qualified.assertUnchanged(); report.finalSource = observeSource(root, expectedCommit, expectedTree); assert.deepEqual(report.finalSource, source);
    report.status = report.cases.some(x => x.status === 'FAIL') ? 'FAIL' : 'PASS_IMPLEMENTED_CASES';
    report.nativePositiveWorkflowsPassed = suite !== 'source' && report.operations.length === 18;
    report.nativeCLIQualified = false;
    // The full external review plan also contains distinct historical-catalog,
    // optional-session lock and release-race cases. Do not silently claim them.
    report.notYetQualified = ['final-native-run-bound-to-reviewed-harness-checkpoint'];
    if (!report.historicalCatalog) report.notYetQualified.push('authentic-six-argument-catalog-cross-generation-rejection');
    if (report.cases.some(x => x.status === 'FAIL')) report.notYetQualified.push(...report.cases.filter(x => x.status === 'FAIL').map(x => x.name));
    report.acceptanceComplete = false;
  } catch (error) {
    report.status = 'FAIL'; report.failures.push({ name: error.name, message: error.message });
    try { report.finalSource = observeSource(root, expectedCommit, expectedTree); } catch (observed) { report.finalSourceFailure = observed.message; }
  } finally {
    if (bridge) { report.http = bridge.snapshot(); report.limitations.eip1898AdapterUsed = report.http.adaptations.some(x => x.kind === 'LOCAL_CANONICAL_HASH_TO_NUMBER'); await bridge.close(); }
    if (connection) await connection.close();
    report.finishedAt = new Date().toISOString(); report.counts = { cases: report.cases.length, passed: report.cases.filter(x => x.status === 'PASS').length, failed: report.cases.filter(x => x.status === 'FAIL').length, commands: report.commands.length, positiveCoreReceipts: report.operations.length };
    report.evidenceFiles = fileInventory(output);
    writeNew(path.join(output, 'report.json'), report);
    const files = [...report.evidenceFiles, { path: 'report.json', sha256: sha256(fs.readFileSync(path.join(output, 'report.json'))) }];
    writeNew(path.join(output, 'SHA256SUMS'), files.map(x => `${x.sha256}  ${x.path}`).join('\n') + '\n');
    if (report.status !== 'FAIL') fs.unlinkSync(path.join(output, 'INCOMPLETE'));
  }
  return report;
}

async function disposableSigner(root) {
  let input = ''; for await (const chunk of process.stdin) { input += chunk; if (input.length > 300000) throw Error('Disposable signer input exceeds bound.'); }
  const { privateKey, unsignedSerialized, overrides } = JSON.parse(input), { require } = sourceModules(fs.realpathSync(root)), E = require('ethers');
  const tx = E.Transaction.from(unsignedSerialized); assert.equal(tx.isSigned(), false); assert.equal(tx.type, 2); assert.equal(tx.to, null);
  const value = tx.toJSON(); delete value.signature; delete value.hash;
  Object.assign(value, overrides); if (value.type === 1) { delete value.maxFeePerGas; delete value.maxPriorityFeePerGas; }
  const wallet = new E.Wallet(privateKey), raw = await wallet.signTransaction(value);
  process.stdout.write(JSON.stringify({ raw }) + '\n');
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    if (process.argv[2] === '--disposable-sign' && process.argv.length === 4) await disposableSigner(process.argv[3]);
    else { const a = parseFlags(process.argv.slice(2), [...FLAGS, ...LEGACY_FLAGS], FLAGS); if (LEGACY_FLAGS.some(k => a[k]) && !LEGACY_FLAGS.every(k => a[k])) throw Error('All four historical source/build flags are required together.'); const report = await runNativeQualification({ sourceRoot: a['source-root'], outputDirectory: a.output, expectedCommit: a['expected-commit'], expectedTree: a['expected-tree'], buildId: a['build-id'], suite: a.suite, legacy: a['legacy-commit'] ? { sourceRoot: a['legacy-source-root'], artifactsRoot: a['legacy-artifacts-root'], commit: a['legacy-commit'], tree: a['legacy-tree'] } : undefined }); process.stdout.write(JSON.stringify({ report: path.join(a.output, 'report.json'), status: report.status, counts: report.counts, acceptanceComplete: report.acceptanceComplete }) + '\n'); if (report.status === 'FAIL') process.exitCode = 1; }
  } catch (error) { console.error(error.stack || error.message); process.exitCode = 1; }
}
