import test from 'node:test';
import assert from 'node:assert/strict';
import { Interface, keccak256, ZeroAddress } from 'ethers';
import { walletConfigurationCalls, validateWalletReceipt, verifiedWalletLinks, WALLET_ALPHA_SOURCE, WALLET_ALPHA_NAMES } from '../verification/wallet-configuration.mjs';
import { GOVERNOR } from '../verification/authority.mjs';

const graph = Object.fromEntries(WALLET_ALPHA_NAMES.map((name, index) => [name, `0x${String(index + 1).padStart(40, '0')}`]));
const clone = value => JSON.parse(JSON.stringify(value));
const abi = new Interface(['function bindMarketplace(address marketplace)', 'function bindMark(address mark)']);
const calls = () => walletConfigurationCalls({ source: WALLET_ALPHA_SOURCE, governor: GOVERNOR, graph });
const proof = () => Object.values(graph).map(address => ({ address, state: 'verified', explorerStatus: 'EXACT_SOURCE_VERIFIED' }));
function receiptFixture(index = 0) {
  const call = calls()[index], hash = '0x' + 'a'.repeat(64), blockHash = '0x' + 'b'.repeat(64), actualRuntime = '0x60006000f3';
  return { call, transaction: { hash, from: GOVERNOR, to: call.to, chainId: '0x1', type: '0x2', input: call.data, value: '0x0', blockHash, blockNumber: '0x20', transactionIndex: '0x1', accessList: [] },
    receipt: { transactionHash: hash, from: GOVERNOR, to: call.to, type: '0x2', status: '0x1', blockHash, blockNumber: '0x20', transactionIndex: '0x1', contractAddress: null },
    canonicalBlock: { hash: blockHash, number: 32 }, expectedRuntimeCodeHash: keccak256(actualRuntime), actualRuntime, observedGetter: call.arguments[0] };
}

test('independent wallet path: exactly two zero-value governor calls preserve actual Alpha binding methods and graph', () => {
  const selected = calls(); assert.equal(selected.length, 2);
  for (const [index, [contract, method, argument]] of [['AscensionRiskOracle','bindMarketplace','AscensionJobMarket'], ['AscensionJobMarket','bindMark','AscensionMark']].entries()) {
    const call = selected[index]; assert.equal(call.index, index); assert.equal(call.chainId, 1); assert.equal(call.from, GOVERNOR); assert.equal(call.to, graph[contract]); assert.equal(call.contract, contract); assert.equal(call.method, method);
    assert.deepEqual(call.arguments, [graph[argument]]); assert.equal(call.data, abi.encodeFunctionData(method, [graph[argument]])); assert.equal(call.valueWei, '0'); assert.equal(call.explorerWriteUrl, null);
    assert.equal(call.manualWalletApprovalRequired, true); assert.equal(call.signingSupported, false); assert.equal(call.relaySupported, false); assert.equal(call.activationAuthorized, false); assert.ok(Object.isFrozen(call));
  }
});
test('independent wallet path: unknown source, wrong governor, incomplete/duplicate/zero graph are refused', () => {
  for (const input of [
    { source: { ...WALLET_ALPHA_SOURCE, commit: 'f'.repeat(40) }, governor: GOVERNOR, graph },
    { source: WALLET_ALPHA_SOURCE, governor: graph.AscensionAccess, graph },
    { source: WALLET_ALPHA_SOURCE, governor: GOVERNOR, graph: { ...graph, AscensionMark: undefined } },
    { source: WALLET_ALPHA_SOURCE, governor: GOVERNOR, graph: { ...graph, NovaSeed: graph.AscensionAccess } },
    { source: WALLET_ALPHA_SOURCE, governor: GOVERNOR, graph: { ...graph, NovaSeed: ZeroAddress } },
  ]) assert.throws(() => walletConfigurationCalls(input));
});
for (const index of [0,1]) test(`independent wallet path: exact field-level receipt is reconciled for binding ${index} without signing or relay`, () => {
  const result = validateWalletReceipt(receiptFixture(index)); assert.equal(result.state, 'reconciled'); assert.equal(result.callIndex, index); assert.equal(result.signingSupported, false); assert.equal(result.relaySupported, false); assert.equal(result.activationAuthorized, false);
});
const mutations = [
  ['wrong chain', x => { x.transaction.chainId = '0xa'; }], ['wrong transaction type', x => { x.transaction.type = '0x4'; }], ['wrong receipt type', x => { x.receipt.type = '0x0'; }],
  ['wrong sender', x => { x.transaction.from = graph.NovaSeed; }], ['wrong receipt sender', x => { x.receipt.from = graph.NovaSeed; }], ['wrong target', x => { x.transaction.to = graph.NovaSeed; }], ['wrong receipt target', x => { x.receipt.to = graph.NovaSeed; }],
  ['nonzero ETH', x => { x.transaction.value = '0x1'; }], ['wrong binding method', x => { x.transaction.input = abi.encodeFunctionData('bindMark', [x.call.arguments[0]]); }], ['wrong binding argument', x => { x.transaction.input = abi.encodeFunctionData('bindMarketplace', [graph.AscensionAccess]); }], ['trailing calldata', x => { x.transaction.input += '00'; }],
  ['failed receipt', x => { x.receipt.status = '0x0'; }], ['different receipt hash', x => { x.receipt.transactionHash = '0x' + 'c'.repeat(64); }], ['contract creation receipt', x => { x.receipt.contractAddress = graph.AscensionMark; }],
  ['transaction authorization list', x => { x.transaction.authorizationList = []; }], ['blob authorization', x => { x.transaction.blobVersionedHashes = []; }], ['nonempty access list', x => { x.transaction.accessList = [{ address: GOVERNOR, storageKeys: [] }]; }],
  ['wrong canonical block', x => { x.canonicalBlock.hash = '0x' + 'd'.repeat(64); }], ['changed receipt block', x => { x.receipt.blockHash = '0x' + 'd'.repeat(64); }], ['wrong transaction block number', x => { x.transaction.blockNumber = '0x21'; }], ['wrong receipt block number', x => { x.receipt.blockNumber = '0x21'; }], ['wrong transaction index', x => { x.receipt.transactionIndex = '0x2'; }],
  ['changed runtime', x => { x.actualRuntime += '00'; }], ['missing runtime', x => { x.actualRuntime = '0x'; }], ['wrong getter', x => { x.observedGetter = graph.AscensionAccess; }],
];
for (const [label, mutate] of mutations) test(`independent wallet path refuses ${label}`, () => { const f = receiptFixture(); mutate(f); assert.throws(() => validateWalletReceipt(f)); });
test('independent wallet path: exact explorer verification is required for all five contracts before any write link', () => {
  for (const index of [0,1,2,3,4]) {
    const verificationResults = proof(); verificationResults[index].state = 'submitted';
    assert.throws(() => verifiedWalletLinks({ calls: calls(), graph, verificationResults }));
    verificationResults[index].state = 'verified'; verificationResults[index].explorerStatus = 'SIMILAR_MATCH';
    assert.throws(() => verifiedWalletLinks({ calls: calls(), graph, verificationResults }));
  }
  const verificationResults = proof(); verificationResults[4].address = graph.NovaSeed;
  assert.throws(() => verifiedWalletLinks({ calls: calls(), graph, verificationResults }));
});
test('independent wallet path: only current unreconciled call receives a link and completed bindings never receive one again', () => {
  for (const completedCount of [0,1,2]) {
    const result = verifiedWalletLinks({ calls: calls(), graph, verificationResults: proof(), completedCount });
    assert.equal(result.filter(x => x.explorerWriteUrl !== null).length, completedCount < 2 ? 1 : 0);
    result.forEach((call, index) => { if (index < completedCount) { assert.equal(call.state, 'already-reconciled-do-not-repeat'); assert.equal(call.explorerWriteUrl, null); } });
  }
});
test('independent wallet path: verified graph cannot authorize a changed target, method, argument, data or ETH value in displayed calls', () => {
  for (const mutate of [x => { x[0].to = GOVERNOR; }, x => { x[0].method = 'transferOwnership'; }, x => { x[0].arguments = [GOVERNOR]; }, x => { x[0].data = '0x'; }, x => { x[0].valueWei = '1'; }]) {
    const selected = clone(calls()); mutate(selected);
    assert.throws(() => verifiedWalletLinks({ calls: selected, graph, verificationResults: proof() }));
  }
});

import { parseWalletOptions, validateWalletReview, walletDeploymentBinding, walletServiceAuthorization } from '../verification/wallet-config.mjs';
import { digest } from '../trust/local-build.mjs';
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
function reviewFixture() {
  return { schema: 'manual-ledger-wallet-configuration-review-v1', chainId: 1, source: { ...WALLET_ALPHA_SOURCE }, governor: GOVERNOR, planSha256: '1'.repeat(64), creationHashes: Array.from({ length: 5 }, (_, i) => '0x' + String(i + 1).repeat(64)), governanceHashes: [], licenseType: '12', native: { checkout: '/independent-unit/source', nodePath: '/independent-unit/node', nodeVersion: '22.17.1', nodeSha256: '2'.repeat(64), planPath: '/independent-unit/plan.json', readRpcUrl: 'https://rpc.example.invalid' } };
}
const optionArguments = () => ['verify', '--review', '/private/review.json', '--reviewed-sha256', '1'.repeat(64), '--build-policy', '/private/build.json', '--reviewed-build-policy-sha256', '2'.repeat(64), '--out', '/private/new-report', '--verification-state', '/private/explorer-state'];
test('independent wallet CLI: only finite read modes and exact review/build pins are accepted', () => {
  for (const mode of ['export','submit-source','verify','reconcile']) { const args = optionArguments(); args[0] = mode; assert.equal(parseWalletOptions(args).mode, mode); }
  assert.equal(parseWalletOptions(['--help']), null);
  for (const mode of ['send','sign','relay','approve','activate','eth_sendRawTransaction']) { const args = optionArguments(); args[0] = mode; assert.throws(() => parseWalletOptions(args)); }
  for (const args of [optionArguments().slice(0, -1), optionArguments().slice(0, -2), [...optionArguments(), '--relay', 'true'], [...optionArguments(), '--rpc-method', 'eth_sendRawTransaction'], [...optionArguments(), '--review', '/private/other.json']]) assert.throws(() => parseWalletOptions(args));
});
test('independent wallet CLI: independent review seal cannot be replaced by a recomputed Ubuntu verdict', () => {
  const review = reviewFixture(), expected = digest(review); assert.equal(validateWalletReview(review, expected), review);
  const changed = clone(review); changed.creationHashes[0] = '0x' + 'f'.repeat(64);
  assert.throws(() => validateWalletReview(changed, expected), { code: 'WALLET_INDEPENDENT_REVIEW_REQUIRED' });
  changed.governor = graph.AscensionAccess; assert.throws(() => validateWalletReview(changed, digest(changed)));
});
test('independent wallet CLI: duplicate/missing receipts, unknown source and unsupported state-changing policy fields are rejected', () => {
  for (const mutate of [x => { x.creationHashes.pop(); }, x => { x.creationHashes[1] = x.creationHashes[0]; }, x => { x.governanceHashes = [x.creationHashes[0]]; }, x => { x.governanceHashes = ['0x'+'a'.repeat(64),'0x'+'b'.repeat(64),'0x'+'c'.repeat(64)]; }, x => { x.source.commit = 'f'.repeat(40); }, x => { x.relayEnabled = true; }, x => { x.native.relayRpcUrl = 'https://relay.example.invalid'; }]) { const review = reviewFixture(); mutate(review); assert.throws(() => validateWalletReview(review, digest(review))); }
});
test('independent wallet CLI: read providers reject HTTP, embedded credentials and fragments without revealing their values', () => {
  for (const readRpcUrl of ['http://127.0.0.1:8545', 'https://user:INDEPENDENT_SECRET_SENTINEL@rpc.example.invalid', 'https://rpc.example.invalid/#INDEPENDENT_SECRET_SENTINEL']) { const review = reviewFixture(); review.native.readRpcUrl = readRpcUrl; assert.throws(() => validateWalletReview(review, digest(review)), error => error.code === 'WALLET_READ_PROVIDER_INVALID' && !error.message.includes('INDEPENDENT_SECRET_SENTINEL')); }
});
test('independent wallet CLI: invalid state-changing invocation makes no output and never reveals supplied private values', async t => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'independent-wallet-cli-'));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const executable = fileURLToPath(new URL('../verification/wallet-config.mjs', import.meta.url));
  const result = spawnSync(process.execPath, [executable, 'relay', '--raw', 'INDEPENDENT_SECRET_SENTINEL', '--out', path.join(directory, 'report')], { encoding: 'utf8', env: { ...process.env, ETHERSCAN_API_KEY: 'INDEPENDENT_API_SECRET_SENTINEL' } });
  assert.equal(result.status, 1); assert.equal(result.stdout, ''); assert.match(result.stderr, /WALLET_READ_MODE_REQUIRED/); assert.equal(result.stderr.includes('SECRET_SENTINEL'), false); assert.deepEqual(await fs.readdir(directory), []);
});

import { openExplorerJournal } from '../verification/private-explorer-journal.mjs';
import { createExplorerVerifier, prepareVerificationTask, canonicalJson } from '../verification/explorer.mjs';
function explorerTask() {
  const standardInput = { language: 'Solidity', sources: { 'contracts/Independent.sol': { content: 'pragma solidity 0.8.37;contract Independent{}' } }, settings: { optimizer: { enabled: true, runs: 40 }, metadata: { bytecodeHash: 'none' }, libraries: {} } };
  return { schema: 'manual-ledger-verification-task-v1', chainId: 1, address: graph.AscensionAccess, qualifiedName: 'contracts/Independent.sol:Independent', compilerVersion: 'v0.8.37+commit.f401782d', standardInput, standardInputSha256: digest(standardInput), constructorArguments: '', libraries: {}, creation: { transactionHash: '0x'+'a'.repeat(64), blockHash: '0x'+'b'.repeat(64), blockNumber: 32, canonical: true, finalized: true, runtimeVerified: true }, licenseType: '12' };
}
const unverifiedSource = () => new Response(JSON.stringify({ status: '1', message: 'OK', result: [{ SourceCode: '', ABI: 'Contract source code not verified', ContractName: '', ContractFileName: '', Library: '', SimilarMatch: '' }] }), { status: 200 });
const exactSource = task => new Response(JSON.stringify({ status: '1', message: 'OK', result: [{ SourceCode: canonicalJson(task.standardInput), ABI: '[]', ContractName: 'Independent', ContractFileName: 'contracts/Independent.sol', CompilerVersion: task.compilerVersion, CompilerType: 'solc', ConstructorArguments: '', Library: '', SimilarMatch: '' }] }), { status: 200 });
async function journalFixture(t) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'independent-wallet-explorer-'));
  const task = explorerTask(), taskId = prepareVerificationTask(task).taskId;
  const options = { directory: path.join(directory, 'private'), identity: { source: WALLET_ALPHA_SOURCE, planSha256: '1'.repeat(64), buildPolicySha256: '2'.repeat(64), taskIds: [taskId], serviceAuthorizationSha256: '3'.repeat(64) } };
  let journal = await openExplorerJournal(options); t.after(async () => { await journal?.close(); await fs.rm(directory, { recursive: true, force: true }); });
  return { task, taskId, options, get journal() { return journal; }, async restart() { await journal.close(); journal = await openExplorerJournal(options); }, async assertNoSecrets() { for (const file of await fs.readdir(options.directory)) assert.equal((await fs.readFile(path.join(options.directory,file),'utf8')).includes('INDEPENDENT_EXPLORER_API_SECRET'), false); } };
}
function explorerClient(f, fetch, transition = f.journal.transition) {
  return createExplorerVerifier({ apiKey: 'INDEPENDENT_EXPLORER_API_SECRET', fetch, readState: f.journal.readState, transition,
    authorizeService: async info => ({ service: 'etherscan-v2', taskId: info.taskId, submitSource: info.taskId === f.taskId }),
    validateCanonical: async task => ({ chainId: 1, address: task.address, ...task.creation, newTarget: true }), sleep: async () => {}, clock: () => 1893456000000,
    limits: { readAttempts: 1, maxPolls: 1 } });
}
test('independent wallet CLI: build identity stays stable across receipt reconciliation and source-publication authorization', () => {
  const review = reviewFixture(), initial = walletDeploymentBinding(review), withReceipt = clone(review); withReceipt.governanceHashes = ['0x'+'a'.repeat(64)];
  assert.equal(walletDeploymentBinding(withReceipt), initial); assert.notEqual(digest(withReceipt), digest(review));
  withReceipt.serviceAuthorization = walletServiceAuthorization(withReceipt); assert.equal(walletDeploymentBinding(withReceipt), initial); assert.equal(validateWalletReview(withReceipt,digest(withReceipt)),withReceipt);
  withReceipt.serviceAuthorization.sourceCommit = 'f'.repeat(40); assert.throws(() => validateWalletReview(withReceipt,digest(withReceipt)));
});
test('independent standalone explorer: lost source POST response is durably uncertain and never reposted after restart', async t => {
  const f = await journalFixture(t); let posts = 0, gets = 0;
  const fetch = async (_url, options) => { if(options.method === 'POST') { posts++; throw Error('SYNTHETIC_SOURCE_POST_RESPONSE_LOSS'); } gets++; return unverifiedSource(); };
  const first = await explorerClient(f,fetch).verify(f.task); assert.equal(first.state,'recovery-required'); assert.equal(posts,1);
  const retained = await f.journal.readState(f.taskId); assert.equal(retained.state,'submission-uncertain'); assert.equal(retained.submissionAttempted,true);
  await f.restart(); const resumed = explorerClient(f,fetch); assert.equal((await resumed.verify(f.task)).state,'recovery-required'); assert.equal((await resumed.recover(f.task)).state,'recovery-required');
  assert.equal(posts,1); assert.equal(gets,3); assert.deepEqual(await f.journal.readState(f.taskId),retained); await f.assertNoSecrets();
});
test('independent standalone explorer: saved GUID resumes status polling after restart and exact-source confirmation without another POST', async t => {
  const f = await journalFixture(t); let posts = 0, phase = 0;
  const guid = 'independent_guid_0123456789';
  const firstFetch = async (url,options) => { const action = new URL(url).searchParams.get('action'); if(options.method === 'POST') { posts++; return new Response(JSON.stringify({status:'1',result:guid}),{status:200}); } if(action==='getsourcecode')return unverifiedSource(); throw Error('SYNTHETIC_STATUS_RESPONSE_LOSS'); };
  await explorerClient(f,firstFetch).verify(f.task); assert.equal((await f.journal.readState(f.taskId)).guid,guid); await f.restart();
  const secondFetch = async (url,options) => { assert.equal(options.method,'GET'); const action = new URL(url).searchParams.get('action'); if(action==='checkverifystatus') { assert.equal(new URL(url).searchParams.get('guid'),guid); phase++; return new Response(JSON.stringify({status:'1',result:'Pass - Verified'}),{status:200}); } return phase ? exactSource(f.task):unverifiedSource(); };
  const result = await explorerClient(f,secondFetch).recover(f.task); assert.equal(result.state,'verified'); assert.equal(posts,1); assert.equal((await f.journal.readState(f.taskId)).submissionAttempted,true); assert.equal((await f.journal.readState(f.taskId)).guid,guid); await f.assertNoSecrets();
});
test('independent standalone explorer: concurrent clients cannot turn a shared stale CAS into two source POSTs', async t => {
  const f = await journalFixture(t); let posts=0;
  const fetch = async (_url,options) => { if(options.method==='POST') { posts++; throw Error('SYNTHETIC_UNCERTAIN_SOURCE_POST'); } return unverifiedSource(); };
  const results=await Promise.allSettled([explorerClient(f,fetch).verify(f.task),explorerClient(f,fetch).verify(f.task)]);
  assert.equal(posts,1); assert.ok(results.some(result=>result.status==='fulfilled'&&result.value.state==='recovery-required')); assert.equal((await f.journal.readState(f.taskId)).submissionAttempted,true); await f.restart(); await explorerClient(f,fetch).verify(f.task); assert.equal(posts,1);
});
test('independent standalone explorer: lost durable-attempt acknowledgement prevents even a first POST until read-only recovery', async t => {
  const f = await journalFixture(t); let posts=0;
  const fetch = async (_url,options) => { if(options.method==='POST')posts++; return unverifiedSource(); };
  const transition=async(next,control)=>{ await f.journal.transition(next,control); if(next.state==='submission-attempted')throw Error('SYNTHETIC_LOST_DURABLE_ATTEMPT_ACK'); };
  await explorerClient(f,fetch,transition).verify(f.task); assert.equal(posts,0); assert.equal((await f.journal.readState(f.taskId)).submissionAttempted,true);
  await f.restart(); assert.equal((await explorerClient(f,fetch).verify(f.task)).state,'recovery-required'); assert.equal(posts,0);
});
