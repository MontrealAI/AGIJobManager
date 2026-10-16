// Actual current native source on a disposable local EVM; no physical or public-network claim.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import https from 'node:https';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { Wallet, Transaction, keccak256, ZeroAddress } from 'ethers';
import { ALPHA_CURRENT as SUPPORTED } from '../coordinators/alpha.mjs';
import { execute, observeSource, sha256, privateWrite, readJson } from '../coordinators/common.mjs';
import { acceptanceAuthority } from './accept-local-trust.mjs';
import { prepareVerificationTask } from '../verification/explorer.mjs';
import { verifyRuntimeEvidence } from '../verification/runtime.mjs';
import { walletConfigurationCalls } from '../verification/wallet-configuration.mjs';
import { digest } from '../trust/local-build.mjs';
const GOVERNOR = '0xd76AD27a1Bcf8652e7e46BE603FA742FD1c10A99';
const root = process.env.WALLET_ACCEPT_CHECKOUT, output = process.env.WALLET_ACCEPT_REPORT;
assert.ok(root && path.isAbsolute(root) && output && path.isAbsolute(output));
observeSource({ checkout: root }, SUPPORTED);
const sourceRequire = createRequire(path.join(root, 'tests/contracts/package.json'));
const { ethers, network } = sourceRequire('hardhat');
assert.equal(network.config.chainId, 1); assert.equal(network.config.hardfork, 'osaka');
const privateRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'manual-ledger-wallet-configuration-'));
const report = { schema: 'manual-ledger-native-wallet-configuration-acceptance-v1', source: SUPPORTED, node: process.versions.node,
  scope: 'Disposable unforked Osaka with actual current native modules; synthetic creator, exact d76 constructor governor, five real CREATEs and two unsigned unexecuted d76 bindings. TLS finalized=latest is a fixture adaptation, not consensus proof.',
  physicalLedger: false, publicProvider: false, mainnetTransactions: 0, governorSignatures: 0, governorBindingSubmissions: 0, activationAuthorized: false };
let server, coordinator, plan, stage = 'fixture', relayCalls = 0, readCalls = 0, loseResponse = false, corruptReceipt = false;
try {
  const native = sourceRequire(path.join(root, 'tests/contracts/authority-test/clean-checkout-cli.cjs')), { certificate, key } = native.createFixtureCertificate(privateRoot);
  const legacy = sourceRequire(path.join(root, 'tests/contracts/scripts/mainnet.js'));
  const { installToken } = sourceRequire(path.join(root, 'tests/contracts/test/utils/token.js'));
  await installToken(); const [sponsor] = await ethers.getSigners();
  const creator = Wallet.createRandom().connect(ethers.provider);
  const governor = { address: GOVERNOR };
  await (await sponsor.sendTransaction({ to: creator.address, value: ethers.parseEther('20') })).wait();
  for (const [name, address] of [['MockAscensionENS', legacy.ENS], ['MockAscensionWrapper', legacy.WRAPPER]]) {
    const deployed = await (await ethers.getContractFactory(name)).deploy(); await ethers.provider.send('hardhat_setCode', [address, await ethers.provider.getCode(deployed.target)]);
  }
  const ens = await ethers.getContractAt('MockAscensionENS', legacy.ENS); for (const name of legacy.roots) await (await ens.setOwner(ethers.namehash(name), governor.address)).wait();
  const dependencies = { token: sourceRequire(path.join(root, 'token.config')).AGIALPHA_ADDRESS, ens: legacy.ENS, wrapper: legacy.WRAPPER };
  const block = await ethers.provider.send('eth_getBlockByNumber', ['latest', false]);
  const config = { schema: 'agialpha.mainnet.config.v2', chainId: 1, deployer: creator.address, nonce: 0, block: { number: Number(BigInt(block.number)), hash: block.hash },
    governor: { kind: 'ledger-eoa', address: governor.address, addressAcknowledgement: governor.address }, dependencies: {}, rootOwners: Object.fromEntries(legacy.roots.map(name => [name, governor.address])),
    parameters: { minimumValidatorStake: '10000000000000000000', minimumAgentStake: '10000000000000000000', quorum: 2, maximumRiskBps: 2000 }, sender: { mode: 'empty-eoa-direct-create.v1' },
    envelope: { gasLimit: '8000000', maxFeePerGas: '10000000000', maxPriorityFeePerGas: '1000000000', accessList: [] } };
  for (const [name, address] of Object.entries(dependencies)) config.dependencies[name] = { address, codeHash: keccak256(await ethers.provider.getCode(address)) };
  const journal = { schema: 'ethereum.cross-project-nonce-journal.v1', journalId: 'SYNTHETIC-COMPANION-ACCEPTANCE', revision: 1, chainId: 1, sender: creator.address, scope: ['alpha', 'jobs', 'manager'], block: config.block, latestNonce: 0, pendingNonce: 0,
    allocations: [{ project: 'alpha', startNonce: 0, count: 5 }, { project: 'jobs', startNonce: 5, count: 1 }, { project: 'manager', startNonce: 6, count: 1 }] };
  stage = 'actual-plan-cli'; const plannerConfig = privateWrite(privateRoot, { config, journal }), planPath = path.join(privateRoot, 'plan.json');
  coordinator = { checkout: root, nodePath: fs.realpathSync(process.execPath), nodeVersion: process.versions.node, nodeSha256: sha256(fs.readFileSync(fs.realpathSync(process.execPath))), planPath, sessionPath: path.join(privateRoot, 'session.jsonl'), lockDirectory: path.join(privateRoot, 'locks'), mode: 'raw-relay', extraCaCertificates: certificate, licenseType: '3' };
  fs.mkdirSync(coordinator.lockDirectory);
  await execute(coordinator, SUPPORTED, path.join(root, 'tests/contracts/scripts/mainnet-authority.js'), ['plan', plannerConfig, planPath]); plan = readJson(planPath);
  const allowed = new Set(['eth_chainId', 'eth_getBlockByNumber', 'eth_getCode', 'eth_call', 'eth_getTransactionCount', 'eth_getBalance', 'eth_getTransactionByHash', 'eth_getTransactionReceipt', 'eth_getLogs']);
  server = https.createServer({ key: fs.readFileSync(key), cert: fs.readFileSync(certificate), minVersion: 'TLSv1.2' }, (request, response) => {
    const chunks = []; let size = 0;
    request.on('data', bytes => { size += bytes.length; if (size > 262144) request.destroy(); else chunks.push(bytes); });
    request.on('end', async () => {
      try {
        assert.equal(request.method, 'POST'); const body = JSON.parse(Buffer.concat(chunks)), relay = request.url === '/relay';
        assert.ok(relay || request.url === '/read'); assert.ok(relay ? body.method === 'eth_sendRawTransaction' : allowed.has(body.method));
        const params = body.method === 'eth_getBlockByNumber' && body.params[0] === 'finalized' ? ['latest', false] : body.params;
        let result = await ethers.provider.send(body.method, params); if (corruptReceipt && body.method === 'eth_getTransactionReceipt' && result) result = { ...result, blockHash: '0x' + '12'.repeat(32) };
        if (relay) { relayCalls++; if (loseResponse) { loseResponse = false, corruptReceipt = false; request.socket.destroy(); return; } } else readCalls++;
        response.writeHead(200, { 'content-type': 'application/json' }); response.end(JSON.stringify({ jsonrpc: '2.0', id: body.id, result }));
      } catch { response.writeHead(400, { 'content-type': 'application/json' }); response.end('{"error":"Disposable fixture rejected"}'); }
    });
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = `https://127.0.0.1:${server.address().port}`; coordinator.readRpcUrl = origin + '/read'; coordinator.relayRpcUrl = origin + '/relay';

  const source = { repository: SUPPORTED.repository, commit: SUPPORTED.commit, tree: SUPPORTED.tree }, creationHashes = [];
  stage = 'five-current-native-creates';
  for (const operation of plan.transactions) { const { from, ...fields } = operation.envelope; const tx = await creator.sendTransaction(fields); await tx.wait(); creationHashes.push(tx.hash); }
  assert.equal(creationHashes.length, 5); assert.equal(relayCalls, 0);
  const review = { schema: 'manual-ledger-wallet-configuration-review-v1', chainId: 1, source, governor: GOVERNOR, planSha256: plan.payloadSha256, creationHashes, governanceHashes: [], licenseType: '3',
    native: { checkout: coordinator.checkout, nodePath: coordinator.nodePath, nodeVersion: coordinator.nodeVersion, nodeSha256: coordinator.nodeSha256, planPath: coordinator.planPath, readRpcUrl: coordinator.readRpcUrl } };
  const reviewPath = privateWrite(privateRoot, review), helper = fileURLToPath(new URL('../verification/native-wallet-snapshot.cjs', import.meta.url));
  const codeFiles = ['verification/native-wallet-snapshot.cjs', 'verification/wallet-configuration.mjs', 'verification/runtime.mjs', 'verification/authority.mjs', 'coordinators/common.mjs', 'scripts/accept-wallet-configuration.mjs'];
  const rootDir = fileURLToPath(new URL('..', import.meta.url)), codeHashes = () => Object.fromEntries(codeFiles.map(file => [file, sha256(fs.readFileSync(path.join(rootDir, file)))]));
  report.acceptanceCodeSha256 = codeHashes();
  const snapshot = async () => { const output = path.join(privateRoot, 'snapshot-' + Math.random().toString(16).slice(2) + '.json'); await execute(coordinator, SUPPORTED, helper, [root, coordinator.planPath, reviewPath, output], { ALPHA_READ_ONLY_RPC_URL: coordinator.readRpcUrl }); return readJson(output); };
  stage = 'native-prebinding-five-contract-export'; const result = await snapshot();
  assert.equal(result.schema, 'manual-ledger-wallet-native-snapshot-v1'); assert.equal(result.tasks.length, 5); assert.equal(result.runtimeEvidence.length, 5); assert.equal(result.governanceReceipts.length, 0);
  assert.equal(result.nativePreflightPassed, true); assert.equal(result.noNativeSigningSessionRequired, true); assert.equal(result.externalTransactions, false);
  const runtimeResults = result.tasks.map((task, index) => { const prepared = prepareVerificationTask(task); return verifyRuntimeEvidence(result.runtimeEvidence[index], { task: prepared.task, expectedSource: source }); });
  assert.equal(runtimeResults.length, 5); const calls = walletConfigurationCalls({ source, governor: GOVERNOR, graph: result.graph });
  assert.equal(calls.length, 2); assert.ok(calls.every(call => call.from === GOVERNOR && call.manualWalletApprovalRequired && call.explorerWriteUrl === null && !call.signingSupported && !call.relaySupported));
  assert.equal(fs.existsSync(coordinator.sessionPath), false); assert.deepEqual(fs.readdirSync(coordinator.lockDirectory), []); assert.equal(relayCalls, 0);
  stage = 'restart-read-only-revalidation'; const restarted = await snapshot();
  assert.deepEqual(restarted.tasks.map(task => prepareVerificationTask(task).taskId), result.tasks.map(task => prepareVerificationTask(task).taskId)); assert.equal(relayCalls, 0);
  stage = 'canonical-receipt-change-negative'; corruptReceipt = true; await assert.rejects(snapshot()); corruptReceipt = false; assert.equal(relayCalls, 0);
  report.authority = await acceptanceAuthority({ adapter: 'alpha', source, graph: plan.addresses, creator: creator.address, governor: GOVERNOR, provider: ethers.provider });
  const pending = new Set(['AscensionRiskOracle.marketplace', 'AscensionJobMarket.mark']);
  assert.ok(report.authority.observations.every(row => pending.has(row.id) ? row.observed === ZeroAddress && row.state === 'mismatch' : row.state === 'match'));
  report.initialUncommissionedStateMatches = true; report.requiredGovernorBindings = [...pending]; report.creationHashes = creationHashes;
  report.verificationTasks = result.tasks.map(({ standardInput, ...task }) => task); report.runtimeEvidence = result.runtimeEvidence; report.runtimeResults = runtimeResults; report.unsignedCalls = calls;
  report.nativeSigningSessionCreated = false; report.nativeActorLocksCreated = false; report.explorerServiceCalls = 0; report.fixtureCreatorSubmissions = 5; report.helperBroadcastRequests = relayCalls;
  report.changedCanonicalReceiptRejected = true; report.repeatedReadOnlySnapshotStable = true; report.readOnlyRequests = readCalls;
  assert.deepEqual(codeHashes(), report.acceptanceCodeSha256, 'Acceptance implementation changed during its own run');
  report.passed = true; report.completedAt = new Date().toISOString(); fs.writeFileSync(output, JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
  console.log('Actual five-CREATE prebinding native wallet snapshot passed; no signing session, d76 signature, governor binding or explorer service call.');
} catch (error) {
  if (process.env.WALLET_ACCEPT_PRIVATE_FAILURE) fs.writeFileSync(process.env.WALLET_ACCEPT_PRIVATE_FAILURE, String(error.stack), { mode: 0o600 });
  report.passed = false; report.failure = { stage, code: error.code || 'ACCEPTANCE_STOPPED' };
  fs.writeFileSync(output, JSON.stringify(report, null, 2) + '\n', { flag: 'wx' }); console.error('Native wallet configuration acceptance stopped.'); process.exitCode = 1;
} finally { if (server) await new Promise(resolve => server.close(resolve)); fs.rmSync(privateRoot, { recursive: true, force: true }); }
