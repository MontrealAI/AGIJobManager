import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { Interface } from 'ethers';
import { ALPHA_CURRENT } from '../coordinators/alpha.mjs';
import { execute, observeSource, runtime, readJson, privateWrite, canonical, ordinary } from '../coordinators/common.mjs';
import { assertTrustedSigningHost, reproduceLocalBuild, digest } from '../trust/local-build.mjs';
import { prepareVerificationTask, createExplorerVerifier } from './explorer.mjs';
import { verifyRuntimeEvidence } from './runtime.mjs';
import { GOVERNOR } from './authority.mjs';
import { WALLET_ALPHA_SOURCE, WALLET_ALPHA_NAMES, walletConfigurationCalls, verifiedWalletLinks } from './wallet-configuration.mjs';
import { openExplorerJournal } from './private-explorer-journal.mjs';

const packageRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const nativeHelper = fileURLToPath(new URL('./native-wallet-snapshot.cjs', import.meta.url));
const equal = (a, b) => JSON.stringify(canonical(a)) === JSON.stringify(canonical(b));
const stop = code => { throw Object.assign(new Error(code), { code }); };
const need = (condition, code = 'WALLET_REVIEW_INVALID') => { if (!condition) stop(code); };
export const WALLET_CONFIG_USAGE = 'node verification/wallet-config.mjs export|submit-source|verify|reconcile --review /absolute/private/wallet-review.json --reviewed-sha256 INDEPENDENT_REVIEW_DIGEST --build-policy /absolute/private/local-build-policy.json --reviewed-build-policy-sha256 INDEPENDENT_BUILD_POLICY_DIGEST --out /absolute/private/NEW_REPORT_DIRECTORY [--verification-state /absolute/private/EXPLORER_STATE] [--recover-dead-verification-owner]';
export function parseWalletOptions(argv) {
  if (argv.length === 1 && argv[0] === '--help') return null;
  const [mode, ...rest] = argv, values = {};
  need(['export', 'submit-source', 'verify', 'reconcile'].includes(mode), 'WALLET_READ_MODE_REQUIRED');
  const required = ['--review', '--reviewed-sha256', '--build-policy', '--reviewed-build-policy-sha256', '--out'], keys = [...required, '--verification-state'];
  for (let i = 0; i < rest.length; i++) { const key = rest[i]; need(values[key] === undefined); if (key === '--recover-dead-verification-owner') { values[key] = true; continue; } need(keys.includes(key) && typeof rest[i + 1] === 'string' && !rest[i + 1].startsWith('--')); values[key] = rest[++i]; }
  need(required.every(key => values[key]) && ['--review', '--build-policy', '--out'].every(key => path.isAbsolute(values[key])) && ['--reviewed-sha256', '--reviewed-build-policy-sha256'].every(key => /^[0-9a-f]{64}$/.test(values[key])) && (mode === 'export' || typeof values['--verification-state'] === 'string' && path.isAbsolute(values['--verification-state'])) && (!values['--verification-state'] || path.isAbsolute(values['--verification-state'])) && (!values['--recover-dead-verification-owner'] || values['--verification-state']));
  return { mode, reviewPath: values['--review'], reviewedSha256: values['--reviewed-sha256'], buildPolicyPath: values['--build-policy'], reviewedBuildPolicySha256: values['--reviewed-build-policy-sha256'], outputDirectory: values['--out'], verificationStateDirectory: values['--verification-state'], recoverDeadVerificationOwner: values['--recover-dead-verification-owner'] === true };
}
function privateJson(filename) {
  const bytes = ordinary(filename, 32 * 1024 * 1024), stat = fs.lstatSync(filename);
  need((stat.mode & 0o077) === 0 && (typeof process.getuid !== 'function' || stat.uid === process.getuid()), 'WALLET_PRIVATE_INPUT_REQUIRED');
  try { return JSON.parse(bytes); } catch { stop('WALLET_PRIVATE_INPUT_REQUIRED'); }
}
function exact(object, keys) { need(object && typeof object === 'object' && !Array.isArray(object) && equal(Object.keys(object).sort(), [...keys].sort())); }
export function validateWalletReview(review, reviewedSha256) {
  need(/^[0-9a-f]{64}$/.test(reviewedSha256) && digest(review) === reviewedSha256, 'WALLET_INDEPENDENT_REVIEW_REQUIRED');
  exact(review, ['schema', 'chainId', 'source', 'governor', 'planSha256', 'creationHashes', 'governanceHashes', 'licenseType', 'native', ...(review.serviceAuthorization === undefined ? [] : ['serviceAuthorization'])]);
  need(review.schema === 'manual-ledger-wallet-configuration-review-v1' && review.chainId === 1 && equal(review.source, WALLET_ALPHA_SOURCE) && review.governor === GOVERNOR && /^[0-9a-f]{64}$/.test(review.planSha256) && /^[1-9][0-9]?$/.test(review.licenseType));
  need(Array.isArray(review.creationHashes) && review.creationHashes.length === 5 && Array.isArray(review.governanceHashes) && review.governanceHashes.length <= 2 && [...review.creationHashes, ...review.governanceHashes].every(hash => /^0x[0-9a-f]{64}$/.test(hash)) && new Set([...review.creationHashes, ...review.governanceHashes]).size === 5 + review.governanceHashes.length, 'WALLET_EXACT_CREATION_AND_BINDING_HASHES_REQUIRED');
  exact(review.native, ['checkout', 'nodePath', 'nodeVersion', 'nodeSha256', 'planPath', 'readRpcUrl']);
  need(['checkout', 'nodePath', 'planPath'].every(key => typeof review.native[key] === 'string' && path.isAbsolute(review.native[key])) && /^[0-9a-f]{64}$/.test(review.native.nodeSha256));
  let endpoint; try { endpoint = new URL(review.native.readRpcUrl); } catch { stop('WALLET_READ_PROVIDER_INVALID'); }
  need(endpoint.protocol === 'https:' && !endpoint.username && !endpoint.password && !endpoint.hash, 'WALLET_READ_PROVIDER_INVALID');
  if (review.serviceAuthorization !== undefined) need(equal(review.serviceAuthorization, walletServiceAuthorization(review)), 'WALLET_SOURCE_SERVICE_AUTHORIZATION_INVALID');
  return review;
}
export function walletDeploymentBinding(review) { const { governanceHashes, serviceAuthorization, ...deployment } = review; return digest(deployment); }
export function walletServiceAuthorization(review) { return { service: 'etherscan-v2', submitSource: true, planSha256: review.planSha256, sourceCommit: review.source.commit, creationHashesSha256: digest(review.creationHashes) }; }
function privateOutputDirectory(directory, checkout) {
  need(path.isAbsolute(directory) && ![packageRoot, checkout].some(root => directory === root || directory.startsWith(root + path.sep)), 'WALLET_OUTPUT_OUTSIDE_SOURCE_REQUIRED');
  const parent = path.dirname(directory), stat = fs.lstatSync(parent);
  need(stat.isDirectory() && !stat.isSymbolicLink() && fs.realpathSync(parent) === parent && (stat.mode & 0o077) === 0 && (typeof process.getuid !== 'function' || stat.uid === process.getuid()), 'WALLET_PRIVATE_OUTPUT_PARENT_REQUIRED');
  fs.mkdirSync(directory, { mode: 0o700 });
  privateWrite(directory, 'Incomplete report. No chain transaction was signed or broadcast. Preserve the durable explorer journal and recover source-submission status by reads.\n', '.txt', 'INCOMPLETE');
}
export function compareLocallyCompiledPlan(plan, build, review) {
  need(plan.payloadSha256 === review.planSha256 && build.receipt.planSha256 === review.planSha256 && build.receipt.campaignSha256 === walletDeploymentBinding(review) && equal(build.receipt.source, review.source) && build.contracts.size === 5, 'WALLET_LOCAL_BUILD_BINDING_MISMATCH');
  need(plan.transactions?.length === 5 && equal([...build.contracts.names()].sort(), [...WALLET_ALPHA_NAMES].sort()), 'WALLET_LOCAL_BUILD_BINDING_MISMATCH');
  for (const [index, name] of WALLET_ALPHA_NAMES.entries()) {
    const local = build.contracts.get(name), native = plan.contracts[name], creation = plan.transactions[index];
    need(creation.name === name && equal(local.abi, native.abi) && local.bytecode === native.bytecode.slice(2) && local.deployedBytecode === native.runtime.slice(2) && equal(local.immutableReferences, native.immutableReferences) && Object.keys(local.linkReferences).length === 0 && Object.keys(local.deployedLinkReferences).length === 0, 'WALLET_LOCAL_BUILD_BINDING_MISMATCH');
    need(`0x${local.bytecode}${new Interface(local.abi).encodeDeploy(creation.constructorArguments).slice(2)}`.toLowerCase() === creation.envelope.data.toLowerCase(), 'WALLET_LOCAL_CONSTRUCTOR_MISMATCH');
  }
  build.assertUnchanged();
}

// Optional review/reconciliation utility for the existing Etherscan + Ledger
// wallet flow. It has no signer, bridge, actor lock, signature packet or relay.
export async function runWalletConfiguration(configuration) {
  assertTrustedSigningHost();
  need(['export', 'submit-source', 'verify', 'reconcile'].includes(configuration.mode), 'WALLET_READ_MODE_REQUIRED');
  const review = validateWalletReview(privateJson(configuration.reviewPath), configuration.reviewedSha256);
  const native = review.native; observeSource(native, ALPHA_CURRENT); runtime(native, ALPHA_CURRENT);
  const buildPolicy = privateJson(configuration.buildPolicyPath), plan = readJson(native.planPath);
  const build = reproduceLocalBuild({ policy: buildPolicy, expectedPolicySha256: configuration.reviewedBuildPolicySha256, sourceRoot: native.checkout, observeSource: () => observeSource(native, ALPHA_CURRENT) });
  compareLocallyCompiledPlan(plan, build, review);
  privateOutputDirectory(configuration.outputDirectory, native.checkout);
  let initial;
  const snapshot = async () => {
    build.assertUnchanged(); need(equal(readJson(native.planPath), plan), 'WALLET_NATIVE_PLAN_CHANGED');
    const output = path.join(configuration.outputDirectory, `${crypto.randomUUID()}-native-read.json`);
    await execute(native, ALPHA_CURRENT, nativeHelper, [native.checkout, native.planPath, configuration.reviewPath, output], { ALPHA_READ_ONLY_RPC_URL: native.readRpcUrl });
    const result = privateJson(output);
    need(result.schema === 'manual-ledger-wallet-native-snapshot-v1' && result.chainId === 1 && equal(result.source, review.source) && result.planSha256 === review.planSha256 && result.governor === GOVERNOR && equal(result.creationHashes, review.creationHashes) && equal(result.governanceHashes, review.governanceHashes) && result.nativePreflightPassed === true && result.noNativeSigningSessionRequired === true && result.externalTransactions === false, 'WALLET_CANONICAL_NATIVE_PROOF_REQUIRED');
    need(result.tasks?.length === 5 && result.runtimeEvidence?.length === 5 && result.governanceReceipts?.length === review.governanceHashes.length, 'WALLET_COMPLETE_FIVE_CREATE_PROOF_REQUIRED');
    const outputHashes = new Set(build.receipt.builds.map(item => item.outputSha256));
    const packages = result.tasks.map((task, index) => {
      const name = WALLET_ALPHA_NAMES[index], local = build.contracts.get(name), expectedCreation = plan.transactions[index];
      need(task.address === plan.addresses[name] && task.qualifiedName === local.qualifiedName && task.constructorArguments === new Interface(local.abi).encodeDeploy(expectedCreation.constructorArguments).slice(2) && build.receipt.builds.some(item => item.inputSha256 === task.standardInputSha256), 'WALLET_LOCAL_VERIFICATION_PACKAGE_MISMATCH');
      const prepared = prepareVerificationTask(task), proof = verifyRuntimeEvidence(result.runtimeEvidence[index], { task: prepared.task, expectedSource: review.source });
      need(outputHashes.has(proof.compilerOutputSha256) && result.runtimeEvidence[index].runtimeTemplate === `0x${local.deployedBytecode}`, 'WALLET_LOCAL_RUNTIME_BUILD_MISMATCH');
      return { prepared, proof };
    });
    need(new Set(packages.map(item => item.prepared.taskId)).size === 5, 'WALLET_COMPLETE_FIVE_CREATE_PROOF_REQUIRED');
    if (initial) need(equal(packages.map(item => ({ id: item.prepared.taskId, runtime: item.proof.runtimeCodeHash, compiler: item.proof.compilerOutputSha256, substitutions: item.proof.substitutionsSha256 })), initial.packages.map(item => ({ id: item.prepared.taskId, runtime: item.proof.runtimeCodeHash, compiler: item.proof.compilerOutputSha256, substitutions: item.proof.substitutionsSha256 }))), 'WALLET_CANONICAL_SOURCE_OR_RUNTIME_DRIFT');
    build.assertUnchanged(); return { result, packages };
  };
  initial = await snapshot();
  const calls = walletConfigurationCalls({ source: review.source, governor: review.governor, graph: initial.result.graph });
  for (const [index, item] of initial.packages.entries()) privateWrite(configuration.outputDirectory, item.prepared, '.json', `${index}-${WALLET_ALPHA_NAMES[index]}-verification-task.json`);
  let verificationResults = [], reviewedCalls = calls, verificationRecoveryOnly = false, recordedSourceSubmissionAttempts = 0;
  if (configuration.mode !== 'export') {
    need(typeof process.env.ETHERSCAN_API_KEY === 'string' && process.env.ETHERSCAN_API_KEY.length > 0, 'WALLET_EXPLORER_READ_KEY_REQUIRED');
    need(typeof configuration.verificationStateDirectory === 'string' && path.isAbsolute(configuration.verificationStateDirectory) && ![packageRoot, native.checkout].some(root => configuration.verificationStateDirectory === root || configuration.verificationStateDirectory.startsWith(root + path.sep)), 'WALLET_PRIVATE_VERIFICATION_STATE_REQUIRED');
    if (configuration.mode === 'submit-source') need(equal(review.serviceAuthorization, walletServiceAuthorization(review)), 'WALLET_SOURCE_SERVICE_AUTHORIZATION_REQUIRED');
    const taskIds = initial.packages.map(item => item.prepared.taskId);
    const journal = await openExplorerJournal({ directory: configuration.verificationStateDirectory, identity: { source: review.source, planSha256: review.planSha256, buildPolicySha256: configuration.reviewedBuildPolicySha256, taskIds, serviceAuthorizationSha256: digest(walletServiceAuthorization(review)) }, forbiddenRoots: [packageRoot, native.checkout], recoverDeadOwner: configuration.recoverDeadVerificationOwner === true });
    verificationRecoveryOnly = journal.recoveredOwner === true;
    try {
      const verifier = createExplorerVerifier({ apiKey: process.env.ETHERSCAN_API_KEY, readState: journal.readState, transition: journal.transition,
        authorizeService: async info => ({ service: 'etherscan-v2', taskId: info.taskId, submitSource: configuration.mode === 'submit-source' && !verificationRecoveryOnly && taskIds.includes(info.taskId) && equal(review.serviceAuthorization, walletServiceAuthorization(review)) }),
        validateCanonical: async task => { const fresh = await snapshot(), item = fresh.packages.find(candidate => candidate.prepared.taskId === prepareVerificationTask(task).taskId); need(item, 'WALLET_CANONICAL_SOURCE_OR_RUNTIME_DRIFT'); return { chainId: 1, address: item.prepared.task.address, ...item.prepared.task.creation, newTarget: true }; } });
      for (const item of initial.packages) verificationResults.push(await (configuration.mode === 'submit-source' && !verificationRecoveryOnly ? verifier.verify(item.prepared.task) : verifier.recover(item.prepared.task)));
      for (const taskId of taskIds) if ((await journal.readState(taskId))?.submissionAttempted === true) recordedSourceSubmissionAttempts++;
    } finally { await journal.close(); }
    if (verificationResults.every(item => item.state === 'verified')) reviewedCalls = verifiedWalletLinks({ calls, graph: initial.result.graph, verificationResults, completedCount: review.governanceHashes.length });
  }
  const report = { schema: 'manual-ledger-wallet-configuration-report-v1', mode: configuration.mode, verificationRecoveryOnly, sourceSubmissionSuppressedForRecovery: verificationRecoveryOnly, recordedSourceSubmissionAttempts, chainId: 1, source: review.source, reviewedSha256: configuration.reviewedSha256, reviewedBuildPolicySha256: configuration.reviewedBuildPolicySha256, localBuildReceipt: build.receipt, planSha256: review.planSha256, snapshot: initial.result.snapshot, graph: initial.result.graph, creationHashes: review.creationHashes, governanceHashes: review.governanceHashes, governanceReceipts: initial.result.governanceReceipts, verifiedCreationCount: 5, nativeSigningSessionRequired: false, companionBridgeRequired: false, physicalLedgerWallet: 'Existing owner-selected Ledger wallet; approval occurs there for each exact transaction', calls: reviewedCalls, explorerResults: verificationResults, sourceVerificationComplete: verificationResults.length === 5 && verificationResults.every(item => item.state === 'verified'), noAutomaticResend: true, externalTransactions: false, signingSupported: false, relaySupported: false, authorityComplete: false, comprehensiveAuthorityComplete: false, activationReady: false, blockers: ['External token/proxy/ENS/controller and wallet/provider permission inventory remains separate', 'No funding, participant admission, unpause or activation is authorized', ...(configuration.mode === 'export' ? ['Exact Etherscan source verification must succeed before wallet configuration links are enabled'] : verificationResults.filter(item => item.state !== 'verified').map(item => item.explorerStatus))] };
  const reportPath = privateWrite(configuration.outputDirectory, { ...report, reportSha256: digest(report) }, '.json', 'wallet-configuration-report.json');
  fs.unlinkSync(path.join(configuration.outputDirectory, 'INCOMPLETE'));
  const directory = fs.openSync(configuration.outputDirectory, 'r'); try { fs.fsyncSync(directory); } finally { fs.closeSync(directory); }
  return Object.freeze({ reportPath, sourceVerificationComplete: report.sourceVerificationComplete, verifiedCreationCount: 5, reconciledConfigurationCount: review.governanceHashes.length, walletConfigurationLinksEnabled: report.sourceVerificationComplete && review.governanceHashes.length < 2, comprehensiveAuthorityComplete: false, activationReady: false, transactionsSubmitted: 0 });
}

async function main() {
  const options = parseWalletOptions(process.argv.slice(2)); if (!options) { process.stdout.write(`${WALLET_CONFIG_USAGE}\n`); return; }
  const result = await runWalletConfiguration(options);
  process.stdout.write(`Report saved. Five creations checked; ${result.reconciledConfigurationCount} wallet binding(s) reconciled.\nExact explorer verification ${result.sourceVerificationComplete ? 'passed' : 'pending'}. No chain transaction was signed or broadcast. Preserve the explorer journal for source-submission recovery by reads. Full authority and activation remain unapproved.\n`);
}
if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) main().catch(error => { const code = /^[A-Z][A-Z0-9_]{0,95}$/.test(error?.code || '') ? error.code : 'WALLET_READ_RECONCILIATION_BLOCKED'; process.stderr.write(`${code}: preserve the private report directory and durable explorer journal. No chain transaction was signed or broadcast. Recover source-submission status by reads; never resend automatically.\n`); process.exitCode = 1; });
