'use strict';
// Offline consistency checks for one dated public record, never an activation gate on-chain.
const fs = require('node:fs');
const path = require('node:path');
const {createHash} = require('node:crypto');
const C = require('../../hardhat/scripts/check-ens-usdc-connection.cjs');
const RECORD = path.resolve(__dirname, '../../config/mainnet/agi-jobs-usdc.json');
// Historical identities at sourceRef; do not compare against a later checkout's Solidity.
const SOURCE_BLOBS = Object.freeze({
  'contracts/AGIJobManager.sol': 'a91536b8ae237c24f8e90eceedd17e5f3e6e14b6',
  'contracts/ens/ENSJobPages.sol': 'b07166f6bec3115bc3e5d4c47cec36861d26f847',
});
// Fixed public projection from Git blob b78082669538f8dd319a3f19f4341dba90c2aaef.
// Canonicalization sorts object keys, preserves array order and exact scalar values.
const HISTORY_SHA256 = '000945c8869f1e6015ba817ce58f8f975c0206deaef6ef9965629091f0f2bb8d';
const TRANSACTION_IDENTITIES = Object.freeze([
  Object.freeze(['0x8a1f7365dca44e6a4259f1df5dece65459e094c77cc9f031f89287aa5cb03d26', 26164090, '0x306494742e356a0254f5927460ff5a73dc6794871f2ce4d6383726884c5bc6ee']),
  Object.freeze(['0x581d3382fa062016d7a16babe9134a6f78e3a7d1b40c104a0ce4b2f71fe182ee', 26164095, '0xc2e5920ade111972bd59d13ac2f4c71427ef2d3dd28a1c73fa3b25afe49cacf9']),
  Object.freeze(['0x57e9a172a024765ed5fb0c8bb1a65df58de3bb5d7aa1cbd0faf2c0424d462f55', 26164101, '0xd9acd978f7dd7b6368659afb817c80eacf6f4b92760264a7da9022cc8d1c34a5']),
  Object.freeze(['0x6378b640f04e39f5091ee6cfed8c51233cf31b70bb363a124fac834c51bec793', 26164104, '0x5c95613f9da2bce90a9db87602e2b77169d85db898c349df82a3b4de85b576d6']),
  Object.freeze(['0x3f154072b5c6ec87452e8f36911be6e7b3e1168c6752eafb06d8fe413e82a224', 26164361, '0xead0ac709bb8d4317a73a47a0e900db79177da64657ba96d89dd8333d83cf465']),
  Object.freeze(['0x6b520363b39c0cd54b1aa99ec6037e2561e18baee76c7274d308880b4b6a21f1', 26164391, '0x96df5e056a36830ebfb3b0437bcacdcc06f412fbbff12b21336d46d92e69d35e']),
]);
const isHash = x => typeof x === 'string' && /^0x[0-9a-fA-F]{64}$/.test(x);
const decimal = x => typeof x === 'string' && /^(0|[1-9][0-9]*)$/.test(x);
function check(ok, code) { if (!ok) throw new Error(code); }
function canonical(value, depth = 0) {
  check(depth <= 32, 'RECORD_JSON_DEPTH');
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return JSON.stringify(value);
  if (typeof value === 'number') {
    check(Number.isFinite(value), 'RECORD_JSON_NUMBER');
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return '[' + value.map(item => canonical(item, depth + 1)).join(',') + ']';
  check(value && typeof value === 'object' &&
    [Object.prototype, null].includes(Object.getPrototypeOf(value)), 'RECORD_JSON_OBJECT');
  return '{' + Object.keys(value).sort().map(key =>
    JSON.stringify(key) + ':' + canonical(value[key], depth + 1)).join(',') + '}';
}
function validate(record) {
  check(record && record.schema === 'agijobmanager-recorded-mainnet-instance-v1', 'RECORD_SCHEMA');
  check(record.chainId === 1 && record.recordDate === '2026-10-10', 'RECORD_CHAIN_DATE');
  check(record.recordType === 'operator-evidence-projection' && record.notLiveState === true &&
    record.notDefaultConfiguration === true, 'RECORD_NOT_LIVE_OR_DEFAULT');
  check(record.sourceRef === '47abe97bfc7fbd502482e92e71ba558a9668ccab', 'RECORD_SOURCE_REF');
  check(record.sourceBlobs && typeof record.sourceBlobs === 'object' &&
    !Array.isArray(record.sourceBlobs) && Object.keys(record.sourceBlobs).length === 2 &&
    Object.entries(SOURCE_BLOBS).every(([file, blob]) => Object.hasOwn(record.sourceBlobs, file) &&
      record.sourceBlobs[file] === blob), 'RECORD_SOURCE_BLOBS');
  for (const key of ['manager', 'helper', 'administrator', 'rootOwner'])
    check(C.eq(record[key], C.P[key]), 'RECORD_ROLE_' + key);
  check(record.jobsRootName === C.P.root && record.jobLabelPrefix === 'job-' &&
    C.eq(record.jobsRootNode, C.P.rootNode) && record.jobZeroPreview === 'job-0.' + C.P.root, 'RECORD_NAMESPACE');
  const c = record.connection, d = record.deployment, r = record.rehearsal, a = record.activation;
  check(c?.status === 'ENS_CONNECTION_CHECK_PASSED_INTAKE_PAUSED' && c.checksPassed === 10, 'RECORD_CONNECTION');
  check(c.snapshot?.number === 26165026 && c.snapshot.hash ===
    '0x6d9d1af91485b6e1567cea4f905087051b3beb921024e90b4573b5361d814fa3', 'RECORD_SNAPSHOT');
  for (const [key, value] of Object.entries(C.CODE_HASHES))
    check(C.eq(c.observed?.runtimeCodeHashes?.[key], value), 'RECORD_CODE_' + key);
  const m = c.observed?.manager, h = c.observed?.helper;
  check(C.eq(m?.ensJobPages, record.helper) && C.eq(h?.jobManager, record.manager), 'RECORD_POINTERS');
  for (const [role, values, fields] of [
    ['manager', m, {usdcToken: C.P.usdc, ens: C.P.registry, nameWrapper: C.P.wrapper}],
    ['helper', h, {ens: C.P.registry, nameWrapper: C.P.wrapper, publicResolver: C.P.resolver}],
  ]) for (const [field, expected] of Object.entries(fields))
    check(C.eq(values[field], expected), 'RECORD_DEPENDENCY_' + role + '_' + field);
  check(C.eq(m.owner, record.administrator) && C.eq(h.owner, record.administrator) &&
    C.eq(m.pendingOwner, C.ZERO), 'RECORD_OWNERS');
  check(m.paused === true && m.settlementPaused === false && m.nextJobId === '0', 'RECORD_PAUSE_AND_JOBS');
  check(m.lockIdentityConfig === false && h.configLocked === false && h.useEnsJobTokenURI === false, 'RECORD_LOCKS');
  check(h.jobsRootName === record.jobsRootName && h.jobLabelPrefix === record.jobLabelPrefix &&
    C.eq(h.jobsRootNode, record.jobsRootNode), 'RECORD_HELPER_NAMESPACE');
  check(C.eq(c.observed.names?.[C.P.root]?.owner, record.rootOwner) &&
    c.observed.newHelperOperatorApproval === true, 'RECORD_CUSTODY_APPROVAL');
  check(record.approvalScope === 'Wallet-wide NameWrapper authority; not restricted to the USDC root.' &&
    record.fullOperatorHistoryReviewed === false, 'RECORD_APPROVAL_SCOPE');
  check(c.observed.knownOperators?.length === 3 && C.OLD_OPERATORS.every(([label, address, hash], i) => {
    const x = c.observed.knownOperators[i];
    return x.label === label && C.eq(x.address, address) && C.eq(x.codeHash, hash) && x.approved === true;
  }), 'RECORD_KNOWN_OPERATORS');
  const j = c.observed.jobZero;
  check(j?.name === record.jobZeroPreview && C.eq(j.node, C.P.firstNode) &&
    j.snapshot?.[0] === false && j.snapshot[1] === '' && C.eq(j.registryOwner, C.ZERO) &&
    C.eq(j.resolver, C.ZERO), 'RECORD_PREVIEW_NOT_CREATED');
  check(d?.statusAtDeployment === 'DEPLOYED_VERIFIED_CONFIGURED_NOT_APPROVED_NOT_ATTACHED' &&
    d.verificationStatus === 'VERIFIED', 'RECORD_HISTORICAL_DEPLOYMENT');
  check(d.finalBlock?.number === 26164106 && isHash(d.finalBlock.hash), 'RECORD_DEPLOYMENT_BLOCK');
  check(JSON.stringify(d.constructorArguments) === JSON.stringify([
    C.P.registry, C.P.wrapper, C.P.resolver, C.P.rootNode, C.P.root]), 'RECORD_CONSTRUCTOR');
  check(d.build?.solcLongVersion === '0.8.37+commit.f401782d' &&
    d.build.runtimeBytes === C.P.helperRuntimeBytes && C.eq(d.runtimeCodeHash, C.CODE_HASHES.helper), 'RECORD_BUILD');
  check(r?.overallStatus === 'REHEARSAL_AND_TRANSPORT_COMPLETED_REVIEW_REQUIRED' &&
    r.simulationChainId === 31337 && r.snapshot?.number === 26163162 && r.checksPassed === 18 &&
    r.publicTransactionsBroadcast === 0 && r.blockedRequests === 0, 'RECORD_FORK_SCOPE');
  check(r.compilerReplay?.passed === true && r.compilerReplay.inputSha256 === d.build.inputSha256 &&
    r.compilerReplay.artifactSha256 === d.build.artifactSha256 &&
    C.eq(r.compilerReplay.runtimeCodeHash, d.runtimeCodeHash), 'RECORD_BUILD_CHAIN');
  check(a?.decision === 'HOLD_INTAKE_ACTIVATION' && a.reviewCompleted === true &&
    a.intakeActivationAuthorized === false && a.productionReadinessCertified === false, 'RECORD_ACTIVATION_HOLD');
  check(a.gates?.length === 5 && a.gates.every((g, i) => g.id === 'A' + (i + 1) &&
    typeof g.status === 'string' && g.status.startsWith('OPEN_') && g.closure?.length > 20), 'RECORD_OPEN_GATES');
  const proposal = a.proposedCanary;
  check(proposal?.status === 'DRAFT_NOT_USER_APPROVED_NOT_APPLIED' &&
    proposal.aggregateOrSingleJobLimitEnforcedByExistingContract === false &&
    proposal.publicAdmissionWindowAcknowledgementRequired === true &&
    proposal.payoutLimitUSDC === '100' && proposal.payoutLimitBaseUnits === '100000000' &&
    ['employer', 'agent', 'agentCredential', 'jobDurationSeconds', 'moderator', 'incidentResponder',
      'operatorLegalIdentity'].every(k => proposal[k] === null), 'RECORD_DRAFT_NOT_APPLIED');
  check(c.transactions?.length === 6 && new Set(c.transactions.map(t => t.hash)).size === 6, 'RECORD_TRANSACTIONS');
  const names = ['deploy', 'setJobManager', 'setJobLabelPrefix', 'transferOwnership', ...C.TX.map(t => t.name)];
  let total = 0n, block = 0;
  for (const [i, t] of c.transactions.entries()) {
    check(t.action === names[i] && isHash(t.hash) && isHash(t.blockHash) &&
      Number.isSafeInteger(t.blockNumber) && t.blockNumber > block && t.blockNumber <= c.snapshot.number &&
      t.status === (i < 4 ? 'CONFIRMED' : 'SUCCESS') && decimal(t.actualFeeWei), 'RECORD_TRANSACTION_' + i);
    const [txHash, blockNumber, blockHash] = TRANSACTION_IDENTITIES[i];
    check(C.eq(t.hash, txHash) && t.blockNumber === blockNumber && C.eq(t.blockHash, blockHash),
      'RECORD_TRANSACTION_IDENTITY_' + i);
    if (i < 4) check(C.eq(t.from, record.deployer) && t.nonce === 233 + i &&
      (i === 0 ? t.to === null : C.eq(t.to, record.helper)), 'RECORD_DEPLOYMENT_TX_ROLE');
    else check(C.eq(t.hash, C.TX[i - 4].hash) && C.eq(t.from, C.TX[i - 4].from) &&
      C.eq(t.to, C.TX[i - 4].to) && t.blockNumber === C.TX[i - 4].block, 'RECORD_OWNER_TX_ROLE');
    total += BigInt(t.actualFeeWei); block = t.blockNumber;
  }
  check(decimal(record.totalSixTransactionFeesWei) && total === BigInt(record.totalSixTransactionFeesWei), 'RECORD_FEES');
  check(record.sourceEvidence?.length === 4 && ['connection', 'deployment', 'rehearsal', 'activation-review'].every((kind, i) => {
    const e = record.sourceEvidence[i];
    return e.kind === kind && /^[a-f0-9]{64}$/.test(e.sha256) && Number.isSafeInteger(e.bytes) && e.bytes > 0 &&
      e.custody === 'Original retained by operator; not copied into this repository.';
  }), 'RECORD_PROVENANCE');
  const text = JSON.stringify(record);
  check(!/\/home\/|\/Users\/|sandbox:|PRIVATE_KEY|MAINNET_RPC_URL|ETHERSCAN_API_KEY|"request"\s*:|"data"\s*:|"repository"\s*:/.test(text), 'RECORD_PRIVATE_OR_RAW_PAYLOAD');
  const historySha256 = createHash('sha256').update(canonical(record)).digest('hex');
  check(historySha256 === HISTORY_SHA256, 'RECORD_HISTORY_FINGERPRINT');
  return { recordConsistent: true, recordDate: record.recordDate, snapshotBlock: c.snapshot.number,
    activationDecision: a.decision, intakeActivationAuthorized: false, productionReadinessCertified: false,
    liveRpcQueries: 0, historySha256, scope: 'Offline public-record consistency only; not current state or independent verification.' };
}
function load() { return JSON.parse(fs.readFileSync(RECORD, 'utf8')); }
module.exports = { validate, load, RECORD };
if (require.main === module) {
  try {
    check(process.argv.length === 2, 'USAGE_node_scripts/commissioning/mainnet-evidence.cjs');
    console.log(JSON.stringify(validate(load()), null, 2));
  } catch (error) { console.error('STOP: ' + error.message); process.exitCode = 1; }
}
