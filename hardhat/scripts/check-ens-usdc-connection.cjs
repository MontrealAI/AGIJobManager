'use strict';
// Read-only commissioning snapshot. No Hardhat, signer, compiler, or explorer submission.
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { createRequire } = require('node:module');
const { createHash } = require('node:crypto');
const ZERO = '0x' + '0'.repeat(40);
const P = Object.freeze({
  manager: '0xCFA78f9980eA9B55c705B3E44467baE383cE1fA7',
  helper: '0x6EE7A600C56C1Bfd12c482190d5dAbDD7194CDBC',
  administrator: '0xa9eD0539c2fbc5C6BC15a2E168bd9BCd07c01201',
  rootOwner: '0xd57243B80FBc5CFB2560E5a644651FEcd7Dc2512',
  parentOwner: '0xd76AD27a1Bcf8652e7e46BE603FA742FD1c10A99',
  registry: '0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e',
  wrapper: '0xD4416b13d2b3a9aBae7AcD5D6C2BbDBE25686401',
  resolver: '0xF29100983E058B709F3D539b0c765937B804AC15',
  registrar: '0x57f1887a8BF19b14fC0dF6Fd9B2acc9Af147eA85',
  usdc: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
  root: 'usdc.jobs.agi.eth', parent: 'jobs.agi.eth', legacyRoot: 'alpha.jobs.agi.eth',
  rootNode: '0x22a145a61e88901e934c12ecdf9cd0601884940492d9c8dbb60cb3abc0bab455',
  firstNode: '0x95d0a7f74c9c0715c911b92e085f2bcce09a689d25567f50ec9020b2ab9d9193',
  helperRuntimeBytes: 15344, minimumExpiry: 2007731864n, minimumRemaining: 30n * 86400n,
});
const CODE_HASHES = Object.freeze({
  helper: '0x6e557d25a905d945c5cf1123715b98ec8522e5fda0678e0ecf0a7b7ec3f5299e',
  manager: '0x346ae8bb4bc480db5f8ed9e53a878162d859cae2345eaba8408929f70f23ea5a',
  registry: '0xd6bfd5d6f1384a1f6ea57b8a8412de5552f138d42021cf7c4941e33206f529e4',
  wrapper: '0xb2d3098f0579718d88a04ee65d3c6827a76823316ceed387945ad993fc6dbb6c',
  resolver: '0x186d03e26f6e0224269c8f7f13a6334d625f1b83812db2045ac7de4f292e9336',
  registrar: '0x15557327bea19f454db3ec207da1a440b6d9318af56e52e2a3eba440d4b62e0a',
});
const OLD_OPERATORS = Object.freeze([
  ['Genesis', '0x06188E77C1C38d392b16d9D9fB24673363ce1da0', '0x878a8048ecb251e0ef835b1d19dbecdb838f97476d36307b5fa510f0919b62ed'],
  ['Prime', '0x703011EF1C6E4277587eFe150e6cd74cA18F0069', '0x45a7e3f459e21940f636f3e5546983b8d4e8bd5331e71b4e57bc7073022709e0'],
  ['Employer Burn', '0xFC1EE3B7DCD3B8643295CaC3150aA630c31190E5', '0x02d0ef972aa3487404236d05dcf9af61f9d7ac4f1ae12b0e2e1836182daf0e56'],
]);
const wordAddress = x => x.slice(2).toLowerCase().padStart(64, '0');
const TX = Object.freeze([
  { name: 'NameWrapper approval', hash: '0x3f154072b5c6ec87452e8f36911be6e7b3e1168c6752eafb06d8fe413e82a224',
    block: 26164361, from: P.rootOwner, to: P.wrapper, nonce: 19,
    data: '0xa22cb465' + wordAddress(P.helper) + '1'.padStart(64, '0'),
    event: 'ApprovalForAll(address,address,bool)', eventAddresses: [P.rootOwner, P.helper], eventData: '0x' + '1'.padStart(64, '0') },
  { name: 'Manager attachment', hash: '0x6b520363b39c0cd54b1aa99ec6037e2561e18baee76c7274d308880b4b6a21f1',
    block: 26164391, from: P.administrator, to: P.manager, nonce: 690,
    data: '0xab460c15' + wordAddress(P.helper),
    event: 'EnsJobPagesUpdated(address,address)', eventAddresses: [ZERO, P.helper], eventData: '0x' },
]);
const ABI = Object.freeze({
  manager: ['function owner() view returns (address)', 'function pendingOwner() view returns (address)',
    'function paused() view returns (bool)', 'function settlementPaused() view returns (bool)',
    'function lockIdentityConfig() view returns (bool)', 'function ensJobPages() view returns (address)',
    'function nextJobId() view returns (uint256)', 'function usdcToken() view returns (address)',
    'function ens() view returns (address)', 'function nameWrapper() view returns (address)'],
  helper: ['function owner() view returns (address)', 'function ens() view returns (address)',
    'function nameWrapper() view returns (address)', 'function publicResolver() view returns (address)',
    'function jobsRootName() view returns (string)', 'function jobsRootNode() view returns (bytes32)',
    'function jobManager() view returns (address)', 'function jobLabelPrefix() view returns (string)',
    'function configLocked() view returns (bool)', 'function useEnsJobTokenURI() view returns (bool)',
    'function jobEnsName(uint256) view returns (string)', 'function jobEnsNode(uint256) view returns (bytes32)',
    'function jobLabelSnapshot(uint256) view returns (bool,string)'],
  wrapper: ['function isApprovedForAll(address,address) view returns (bool)',
    'function getData(uint256) view returns (address,uint32,uint64)'],
  registry: ['function owner(bytes32) view returns (address)', 'function resolver(bytes32) view returns (address)',
    'function ttl(bytes32) view returns (uint64)'],
  registrar: ['function nameExpires(uint256) view returns (uint256)'],
});
const METHODS = new Set(['eth_chainId', 'eth_getBlockByNumber', 'eth_getTransactionByHash', 'eth_getTransactionReceipt', 'eth_getCode', 'eth_call']);
const eq = (a, b) => typeof a === 'string' && typeof b === 'string' && a.toLowerCase() === b.toLowerCase();
const bytes = x => typeof x === 'string' && /^0x(?:[a-fA-F0-9]{2})*$/.test(x);
const hash = x => typeof x === 'string' && /^0x[a-fA-F0-9]{64}$/.test(x);
class Stop extends Error { constructor(code) { super(code); this.name = 'Stop'; this.code = code; } }
function ensure(ok, code) { if (!ok) throw new Stop(code); }
function quantity(x) { ensure(typeof x === 'string' && /^0x(?:0|[1-9a-f][0-9a-f]*)$/i.test(x), 'MALFORMED_RPC_QUANTITY'); return BigInt(x); }
function blockInfo(b) {
  ensure(b && hash(b.hash), 'MISSING_BLOCK_IDENTITY');
  const n = quantity(b.number), t = quantity(b.timestamp);
  ensure(n > 0n && n <= BigInt(Number.MAX_SAFE_INTEGER) && t > 0n, 'BLOCK_OUT_OF_RANGE');
  return { number: Number(n), hash: b.hash.toLowerCase(), timestampSeconds: t.toString(), tag: b.number };
}
function validateReceipt(E, spec, tx, receipt, block, snapshot) {
  ensure(tx && receipt, 'TRANSACTION_OR_RECEIPT_MISSING');
  ensure(eq(tx.hash, spec.hash) && eq(receipt.transactionHash, spec.hash), 'RECEIPT_HASH_MISMATCH');
  ensure(eq(tx.from, spec.from) && eq(receipt.from, spec.from) && eq(tx.to, spec.to) && eq(receipt.to, spec.to), 'TRANSACTION_ROLE_MISMATCH');
  ensure(quantity(tx.chainId) === 1n && quantity(tx.value) === 0n && quantity(tx.nonce) === BigInt(spec.nonce), 'TRANSACTION_CHAIN_VALUE_OR_NONCE_MISMATCH');
  ensure(eq(tx.input, spec.data), 'TRANSACTION_CALLDATA_MISMATCH');
  ensure(quantity(receipt.status) === 1n, 'TRANSACTION_REVERTED');
  const bn = quantity(receipt.blockNumber);
  ensure(bn === BigInt(spec.block) && quantity(tx.blockNumber) === bn && block.number === spec.block, 'TRANSACTION_BLOCK_MISMATCH');
  ensure(eq(tx.blockHash, block.hash) && eq(receipt.blockHash, block.hash), 'TRANSACTION_NOT_CANONICAL');
  ensure(quantity(tx.transactionIndex) === quantity(receipt.transactionIndex), 'TRANSACTION_INDEX_MISMATCH');
  ensure(receipt.contractAddress === null, 'UNEXPECTED_CONTRACT_CREATION');
  const confirmations = BigInt(snapshot.number) - bn + 1n;
  ensure(confirmations >= 3n, 'WAIT_FOR_THREE_CONFIRMATIONS');
  const topics = [E.id(spec.event), ...spec.eventAddresses.map(a => '0x' + wordAddress(a))];
  const matching = (receipt.logs || []).filter(l => eq(l.address, spec.to) && eq(l.topics?.[0], topics[0]));
  ensure(matching.length === 1, 'EXPECTED_EVENT_MISSING_OR_DUPLICATED');
  const log = matching[0];
  ensure(log.removed !== true && Array.isArray(log.topics) && log.topics.length === topics.length &&
    log.topics.every((t, i) => eq(t, topics[i])) && eq(log.data, spec.eventData), 'EVENT_CONTENT_MISMATCH');
  ensure(eq(log.transactionHash, spec.hash) && eq(log.blockHash, block.hash) && quantity(log.blockNumber) === bn &&
    quantity(log.transactionIndex) === quantity(receipt.transactionIndex), 'EVENT_IDENTITY_MISMATCH');
  const fee = quantity(receipt.gasUsed) * quantity(receipt.effectiveGasPrice);
  return { action: spec.name, hash: spec.hash, from: spec.from, to: spec.to, blockNumber: spec.block,
    blockHash: block.hash, confirmationsAtSnapshot: confirmations.toString(), status: 'SUCCESS',
    expectedCalldataMatched: true, expectedEventMatched: true, actualFeeWei: fee.toString() };
}
function startReport() { return { schema: 'ENSJobPages-USDC-connection-review-v1', status: 'IN_PROGRESS',
  scope: 'Two confirmed owner actions and pinned ENS connection readback; not full financial/security/production readiness.',
  publicTransactionsBroadcast: 0, intakeActivationAuthorized: false, productionReadinessCertified: false,
  checks: [], observed: {}, stage: 'INITIALIZATION', limitations: [
    'One operator-configured RPC supplies the observations; this is not an independent consensus or operator audit.',
    'No live job is created, no lifecycle is rerun, and no full manager financial/NFT/participant qualification is performed.',
    'The three known legacy operators are checked, not the full wallet approval history.',
    'Explorer verification is not repeated here; prior deployment evidence is preserved separately.',
    'The manager token-URI flag is private and is not read by this getter-only checker.',
    'State is checked at the recorded block; later owner transactions can change it.' ] }; }
async function collect(E, rpc, report = startReport(), say = () => {}) {
  const stage = s => { report.stage = s; say('CHECKING: ' + s); };
  const pass = s => { report.checks.push(s); say('PASS: ' + s); };
  stage('CHAIN_AND_SNAPSHOT');
  ensure(quantity(await rpc('eth_chainId', [])) === 1n, 'WRONG_CHAIN');
  const snapshot = blockInfo(await rpc('eth_getBlockByNumber', ['latest', false]));
  ensure(snapshot.number >= TX[1].block + 2, 'WAIT_FOR_ATTACHMENT_CONFIRMATIONS');
  report.snapshot = snapshot;
  stage('OWNER_TRANSACTION_RECEIPTS');
  report.transactions = [];
  const receiptBlocks = [];
  for (const spec of TX) {
    const tx = await rpc('eth_getTransactionByHash', [spec.hash]);
    const receipt = await rpc('eth_getTransactionReceipt', [spec.hash]);
    const b = blockInfo(await rpc('eth_getBlockByNumber', ['0x' + spec.block.toString(16), false]));
    receiptBlocks.push(b);
    report.transactions.push(validateReceipt(E, spec, tx, receipt, b, snapshot));
    pass(spec.name + ': receipt, sender, calldata and event match');
  }
  stage('RUNTIME_FINGERPRINTS');
  report.observed.runtimeCodeHashes = {};
  for (const [role, expected] of Object.entries(CODE_HASHES)) {
    const code = await rpc('eth_getCode', [P[role], snapshot.tag]);
    ensure(bytes(code) && code !== '0x', 'CODE_MISSING_' + role);
    const digest = E.keccak256(code);
    ensure(eq(digest, expected), 'RUNTIME_HASH_MISMATCH_' + role);
    if (role === 'helper') ensure((code.length - 2) / 2 === P.helperRuntimeBytes, 'HELPER_RUNTIME_SIZE_MISMATCH');
    report.observed.runtimeCodeHashes[role] = digest;
  }
  pass('Helper, manager and ENS dependencies match recorded runtime fingerprints');
  const iface = Object.fromEntries(Object.entries(ABI).map(([k, v]) => [k, new E.Interface(v)]));
  const call = async (role, fn, args = [], address = P[role]) => {
    const raw = await rpc('eth_call', [{ to: address, data: iface[role].encodeFunctionData(fn, args) }, snapshot.tag]);
    ensure(bytes(raw) && raw !== '0x', 'EMPTY_OR_MALFORMED_CALL_' + fn);
    try { return iface[role].decodeFunctionResult(fn, raw); }
    catch { throw new Stop('ABI_DECODE_FAILED_' + fn); }
  };
  stage('BIDIRECTIONAL_CONFIGURATION');
  const expectedManager = { owner: P.administrator, pendingOwner: ZERO, paused: true, settlementPaused: false,
    lockIdentityConfig: false, ensJobPages: P.helper, nextJobId: 0n, usdcToken: P.usdc, ens: P.registry,
    nameWrapper: P.wrapper };
  const expectedHelper = { owner: P.administrator, ens: P.registry, nameWrapper: P.wrapper,
    publicResolver: P.resolver, jobsRootName: P.root, jobsRootNode: P.rootNode, jobManager: P.manager,
    jobLabelPrefix: 'job-', configLocked: false, useEnsJobTokenURI: false };
  for (const [role, fields] of [['manager', expectedManager], ['helper', expectedHelper]]) {
    const observed = report.observed[role] = {};
    for (const [fn, expected] of Object.entries(fields)) {
      const value = (await call(role, fn))[0]; observed[fn] = value;
      const matches = typeof expected === 'string' && expected.startsWith('0x') ? eq(value, expected) : value === expected;
      ensure(matches, 'CONFIG_MISMATCH_' + role + '_' + fn);
    }
  }
  pass('Both manager/helper pointers and administrator, root and prefix match');
  pass('Intake is paused; no jobs allocated; configuration locks and helper token-URI setting remain unchanged');
  stage('ROOT_CUSTODY_AUTHORITY_AND_EXPIRY');
  ensure(E.namehash(P.root) === P.rootNode, 'ROOT_NAMEHASH_MISMATCH');
  const names = report.observed.names = {};
  for (const name of [P.parent, P.root, P.legacyRoot]) {
    const node = E.namehash(name), data = await call('wrapper', 'getData', [BigInt(node)]);
    const item = names[name] = { namehash: node,
      registryOwner: (await call('registry', 'owner', [node]))[0], resolver: (await call('registry', 'resolver', [node]))[0],
      ttl: (await call('registry', 'ttl', [node]))[0], owner: data[0], fuses: data[1], expiry: data[2] };
    ensure(eq(item.registryOwner, P.wrapper), 'NAME_NOT_WRAPPED');
    ensure(eq(item.owner, name === P.parent ? P.parentOwner : P.rootOwner), 'NAME_CUSTODY_MISMATCH');
    ensure(item.fuses === 327681n, 'FUSES_CHANGED_REVIEW_REQUIRED');
    ensure(item.expiry >= P.minimumExpiry && item.expiry >= BigInt(snapshot.timestampSeconds) + P.minimumRemaining, 'EXPIRY_REQUIRES_REVIEW');
    if (name !== P.parent) ensure(eq(item.resolver, P.resolver) && item.ttl === 0n, 'ROOT_RESOLVER_OR_TTL_CHANGED');
  }
  ensure(names[P.root].expiry <= names[P.parent].expiry, 'ROOT_EXCEEDS_PARENT_EXPIRY');
  report.observed.agiRegistrationExpiry = (await call('registrar', 'nameExpires', [BigInt(E.id('agi'))]))[0];
  ensure(report.observed.agiRegistrationExpiry >= BigInt(snapshot.timestampSeconds) + P.minimumRemaining, 'AGI_REGISTRATION_EXPIRY_REQUIRES_REVIEW');
  report.observed.newHelperOperatorApproval = (await call('wrapper', 'isApprovedForAll', [P.rootOwner, P.helper]))[0];
  ensure(report.observed.newHelperOperatorApproval === true, 'HELPER_OPERATOR_APPROVAL_NOT_ACTIVE');
  pass('USDC root stays in the shared wallet and its helper approval is active');
  pass('Parent/root permissions and expiry remain compatible with creating subnames');
  report.observed.knownOperators = [];
  for (const [label, address, expected] of OLD_OPERATORS) {
    const approved = (await call('wrapper', 'isApprovedForAll', [P.rootOwner, address]))[0];
    const code = await rpc('eth_getCode', [address, snapshot.tag]);
    ensure(approved === true && bytes(code) && eq(E.keccak256(code), expected), 'KNOWN_OPERATOR_CHANGED_REVIEW_REQUIRED');
    report.observed.knownOperators.push({ label, address, approved, codeHash: expected });
  }
  pass('Three known legacy approvals and operator fingerprints are unchanged');
  stage('JOB_ZERO_PREVIEW_WITHOUT_CREATION');
  const preview = report.observed.jobZero = {
    name: (await call('helper', 'jobEnsName', [0n]))[0], node: (await call('helper', 'jobEnsNode', [0n]))[0],
    snapshot: Array.from(await call('helper', 'jobLabelSnapshot', [0n])),
    registryOwner: (await call('registry', 'owner', [P.firstNode]))[0], resolver: (await call('registry', 'resolver', [P.firstNode]))[0],
  };
  ensure(preview.name === 'job-0.' + P.root && eq(preview.node, P.firstNode), 'JOB_ZERO_PREVIEW_MISMATCH');
  ensure(preview.snapshot[0] === false && preview.snapshot[1] === '' && eq(preview.registryOwner, ZERO) && eq(preview.resolver, ZERO), 'JOB_ZERO_ALREADY_HAS_STATE_REVIEW_REQUIRED');
  pass('job-0.usdc.jobs.agi.eth previews correctly and has not been precreated');
  stage('FINAL_CANONICAL_BLOCK_RECHECK');
  for (const first of [...receiptBlocks, snapshot]) {
    const again = blockInfo(await rpc('eth_getBlockByNumber', [first.tag, false]));
    ensure(again.number === first.number && again.hash === first.hash && again.timestampSeconds === first.timestampSeconds, 'BLOCK_CHANGED_DURING_CHECK');
  }
  ensure(quantity(await rpc('eth_chainId', [])) === 1n, 'CHAIN_CHANGED_DURING_CHECK');
  pass('Snapshot and both receipt blocks remain canonical on the same RPC');
  report.status = 'ENS_CONNECTION_CHECK_PASSED_INTAKE_PAUSED'; report.stage = 'COMPLETE';
  report.createdAt = new Date().toISOString();
  report.approvalScope = 'Wallet-wide NameWrapper authority; not restricted to the USDC root.';
  return report;
}
function makeRpc(url, fetchImpl, audit) {
  let endpoint; try { endpoint = new URL(url); } catch { throw new Stop('RPC_URL_INVALID'); }
  ensure(endpoint.protocol === 'https:' && endpoint.hostname && !endpoint.hash, 'RPC_MUST_BE_HTTPS');
  return async (method, params) => {
    ensure(METHODS.has(method) && Array.isArray(params), 'NON_READ_RPC_METHOD_REFUSED');
    ensure(audit.requestsAttempted < 250, 'RPC_REQUEST_LIMIT_REACHED');
    const id = ++audit.requestsAttempted;
    audit.methodsAttempted[method] = (audit.methodsAttempted[method] || 0) + 1;
    let response, payload;
    try {
      response = await fetchImpl(endpoint, { method: 'POST', redirect: 'error', signal: AbortSignal.timeout(25000),
        headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id, method, params }) });
      ensure(response.ok, 'RPC_HTTP_FAILURE');
      payload = await response.json();
    } catch (error) { if (error instanceof Stop) throw error; throw new Stop('RPC_TRANSPORT_FAILURE'); }
    ensure(payload && payload.jsonrpc === '2.0' && payload.id === id && !payload.error && Object.hasOwn(payload, 'result'), 'RPC_RESPONSE_ERROR_OR_MALFORMED');
    return payload.result;
  };
}
function argumentsRepo(argv) { ensure(argv.length === 2 && argv[0] === '--repo' && argv[1], 'USE_CHECK_CONNECTION_WITH_REPO'); return fs.realpathSync(argv[1]); }
function writeReport(dir, report) {
  const name = path.join(dir, 'CONNECTION_REVIEW.json');
  fs.writeFileSync(name, JSON.stringify(report, (_, v) => typeof v === 'bigint' ? v.toString() : v, 2) + '\n', { flag: 'wx', mode: 0o600 });
  return name;
}
async function main() {
  const report = startReport();
  const dir = fs.mkdtempSync(path.join(os.homedir(), 'ENSJobPages-USDC-Connection-'));
  fs.chmodSync(dir, 0o700);
  console.log('Reports directory: ' + dir);
  try {
    report.stage = 'LOCAL_DEPENDENCIES_AND_RPC_SETTING';
    const repo = argumentsRepo(process.argv.slice(2));
    ensure(!process.env.NODE_OPTIONS && !process.env.NODE_PATH, 'NODE_PRELOAD_SETTINGS_REQUIRE_REVIEW');
    const local = createRequire(path.join(repo, 'hardhat', 'package.json'));
    const E = local('ethers'), dotenv = local('dotenv');
    ensure(/^6\./.test(E.version || ''), 'ETHERS_6_REQUIRED_NO_INSTALL_PERFORMED');
    let url = process.env.MAINNET_RPC_URL;
    if (url === undefined) {
      const raw = fs.readFileSync(path.join(repo, 'hardhat', '.env'), 'utf8');
      url = dotenv.parse(raw).MAINNET_RPC_URL;
    }
    ensure(typeof url === 'string' && url.length > 0, 'MAINNET_RPC_URL_MISSING_OR_EMPTY');
    report.runtime = { node: process.version, ethers: E.version };
    report.transport = { allowedMethods: [...METHODS], requestsAttempted: 0, methodsAttempted: {} };
    report.scriptSha256 = createHash('sha256').update(fs.readFileSync(__filename)).digest('hex');
    await collect(E, makeRpc(url, fetch, report.transport), report, console.log);
  } catch (error) {
    report.status = 'STOPPED_REVIEW_REQUIRED';
    report.failure = { code: error instanceof Stop ? error.code : 'LOCAL_SETUP_OR_IO_FAILURE',
      nativeCode: typeof error.code === 'string' && /^[A-Z0-9_]{1,90}$/.test(error.code) ? error.code : null };
    process.exitCode = 1;
    console.error('STOP: ' + report.stage + ' ' + report.failure.code);
  }
  const file = writeReport(dir, report);
  if (!process.exitCode) console.log('ENS CONNECTION CHECK PASSED. Intake is paused. No transactions sent.');
  console.log('Attach: ' + file);
}
module.exports = { P, ZERO, CODE_HASHES, OLD_OPERATORS, TX, ABI, METHODS, Stop, ensure, eq, quantity,
  blockInfo, validateReceipt, startReport, collect, makeRpc, argumentsRepo, writeReport };
if (require.main === module) main().catch(() => { console.error('STOP: unable to create or save the private report. No signing interface exists in this checker.'); process.exitCode = 1; });
