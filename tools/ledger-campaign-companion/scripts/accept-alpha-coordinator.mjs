// Synthetic local acceptance. This script is never imported by either browser or production server.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import https from 'node:https';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { Wallet, Transaction, keccak256 } from 'ethers';
import { createAlphaAdapter, ALPHA_SUPPORTED } from '../coordinators/alpha.mjs';
import { execute, observeSource, sha256, canonical, privateWrite, readJson } from '../coordinators/common.mjs';
import { policyDigest } from '../src/envelope.mjs';

const root = process.env.ALPHA_ACCEPT_CHECKOUT, output = process.env.ALPHA_ACCEPT_REPORT;
assert.ok(root && path.isAbsolute(root) && output && path.isAbsolute(output));
observeSource({ checkout: root }, ALPHA_SUPPORTED);
const sourceRequire = createRequire(path.join(root, 'tests/contracts/package.json'));
const { ethers, network } = sourceRequire('hardhat');
assert.equal(network.config.chainId, 1); assert.equal(network.config.hardfork, 'osaka');
const privateRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'manual-ledger-alpha-accept-'));
const report = { schema: 'manual-ledger-genuine-alpha-adapter-acceptance-v1', source: ALPHA_SUPPORTED, node: process.versions.node,
  scope: 'Unforked disposable Osaka, synthetic keys and mock dependencies, normal child-scoped local TLS, finalized=latest; not physical Ledger/public-provider/finality qualification',
  hardware: false, publicProvider: false, oldDeploymentTransactions: 0, activationAllowed: false, checks: [], operations: [] };
const companionRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const codeHashes = () => Object.fromEntries(['coordinators/common.mjs', 'coordinators/alpha.mjs', 'scripts/accept-alpha-coordinator.mjs'].map(name => [name, sha256(fs.readFileSync(path.join(companionRoot, name)))]));
report.acceptanceCodeSha256 = codeHashes();
let server, stage = 'fixture', relayCalls = 0, readCalls = 0, loseResponse = false;
const check = name => report.checks.push(name);
try {
  const native = sourceRequire(path.join(root, 'tests/contracts/authority-test/clean-checkout-cli.cjs')), { certificate, key } = native.createFixtureCertificate(privateRoot);
  const legacy = sourceRequire(path.join(root, 'tests/contracts/scripts/mainnet.js'));
  const { installToken } = sourceRequire(path.join(root, 'tests/contracts/test/utils/token.js'));
  await installToken(); const [sponsor, governorSigner] = await ethers.getSigners();
  const creator = Wallet.createRandom().connect(ethers.provider);
  const governor = ethers.HDNodeWallet.fromPhrase('test test test test test test test test test test test junk', undefined, "m/44'/60'/0'/0/1").connect(ethers.provider); assert.equal(governor.address, governorSigner.address);
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
  const coordinator = { checkout: root, nodePath: fs.realpathSync(process.execPath), nodeVersion: process.versions.node, nodeSha256: sha256(fs.readFileSync(fs.realpathSync(process.execPath))), planPath, sessionPath: path.join(privateRoot, 'session.jsonl'), lockDirectory: path.join(privateRoot, 'locks'), mode: 'raw-relay', extraCaCertificates: certificate, licenseType: '3' };
  fs.mkdirSync(coordinator.lockDirectory);
  await execute(coordinator, ALPHA_SUPPORTED, path.join(root, 'tests/contracts/scripts/mainnet-authority.js'), ['plan', plannerConfig, planPath]); const plan = readJson(planPath);
  const allowed = new Set(['eth_chainId', 'eth_getBlockByNumber', 'eth_getCode', 'eth_call', 'eth_getTransactionCount', 'eth_getBalance', 'eth_getTransactionByHash', 'eth_getTransactionReceipt', 'eth_getLogs']);
  server = https.createServer({ key: fs.readFileSync(key), cert: fs.readFileSync(certificate), minVersion: 'TLSv1.2' }, (request, response) => {
    const chunks = []; let size = 0;
    request.on('data', bytes => { size += bytes.length; if (size > 262144) request.destroy(); else chunks.push(bytes); });
    request.on('end', async () => {
      try {
        assert.equal(request.method, 'POST'); const body = JSON.parse(Buffer.concat(chunks)), relay = request.url === '/relay';
        assert.ok(relay || request.url === '/read'); assert.ok(relay ? body.method === 'eth_sendRawTransaction' : allowed.has(body.method));
        const params = body.method === 'eth_getBlockByNumber' && body.params[0] === 'finalized' ? ['latest', false] : body.params;
        const result = await ethers.provider.send(body.method, params);
        if (relay) { relayCalls++; if (loseResponse) { loseResponse = false; request.socket.destroy(); return; } } else readCalls++;
        response.writeHead(200, { 'content-type': 'application/json' }); response.end(JSON.stringify({ jsonrpc: '2.0', id: body.id, result }));
      } catch { response.writeHead(400, { 'content-type': 'application/json' }); response.end('{"error":"Disposable fixture rejected"}'); }
    });
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = `https://127.0.0.1:${server.address().port}`; coordinator.readRpcUrl = origin + '/read'; coordinator.relayRpcUrl = origin + '/relay';
  const expiresAt = new Date(Date.now() + 3600000).toISOString(), sourceSha256 = '0x' + sha256(JSON.stringify(canonical({ revision: plan.revision, contracts: plan.contracts, builds: plan.builds })));
  const governanceStartNonce = await governor.getNonce();
  const envelopes = [...plan.transactions.map(x => x.envelope), ...plan.governanceCalls.map((x, i) => ({ type: 2, chainId: 1, from: governor.address, nonce: governanceStartNonce + i, to: x.to, value: '0', data: x.data, gasLimit: '1000000', maxFeePerGas: '10000000000', maxPriorityFeePerGas: '1000000000', accessList: [] }))];
  const operations = envelopes.map((envelope, step) => {
    const { from, ...fields } = envelope, unsignedHex = Transaction.from(fields).unsignedSerialized, expectedUnsignedHash = keccak256(unsignedHex);
    const review = { chainId: '1', expectedSender: from, expiresAt, maxGasLimit: envelope.gasLimit, maxFeePerGas: envelope.maxFeePerGas, maxPriorityFeePerGas: envelope.maxPriorityFeePerGas, maxTotalFeeWei: (BigInt(envelope.gasLimit) * BigInt(envelope.maxFeePerGas)).toString(), maxValueWei: '0', operationId: `alpha-${step}`, sourceSha256 };
    return { operationId: review.operationId, unsignedHex, expectedUnsignedHash, expectedPolicyHash: policyDigest(review, expectedUnsignedHash), review };
  });
  const campaign = { expiresAt, reviewedManifest: { source: { repository: ALPHA_SUPPORTED.repository, commit: ALPHA_SUPPORTED.commit, tree: ALPHA_SUPPORTED.tree }, sourceSha256, planSha256: plan.payloadSha256, operations }, coordinator };
  let adapter = createAlphaAdapter(); assert.equal(adapter.inspectCampaign(campaign).route.decimals, 18); check('Actual sealed plan supplies separate AGIALPHA route and creator/governor roles');
  for (let step = 0; step < 7; step++) {
    stage = `operation-${step}`; const operationId = operations[step].operationId, before = relayCalls;
    const prepared = await adapter.prepare({ campaign, step, privateDir: privateRoot }); assert.equal(relayCalls, before); assert.equal(prepared.prepared.unsignedHex, operations[step].unsignedHex);
    if (step === 0) {
      await assert.rejects(adapter.prepare({ campaign, step, privateDir: privateRoot }), /RECOVERY_REQUIRED_EXISTING_SIGNING_INTENT/); check('Duplicate signing request stops on existing durable intent');
      const wrong = await Wallet.createRandom().signTransaction(Transaction.from(prepared.prepared.unsignedHex));
      await assert.rejects(adapter.importSigned({ campaign, step, operationId, raw: wrong, privateDir: privateRoot }), /SIGNED_CAPABILITY_MISMATCH/); check('Wrong actual account fails before any coordinator import');
    }
    const signer = step < 5 ? creator : governor, raw = await signer.signTransaction(Transaction.from(prepared.prepared.unsignedHex));
    const imported = await adapter.importSigned({ campaign, step, operationId, raw, privateDir: privateRoot }); assert.equal(imported.transactionHash, keccak256(raw));
    if (step === 0) { loseResponse = true; await assert.rejects(adapter.relayOne({ campaign, step, operationId, acknowledgement: imported.acknowledgement, privateDir: privateRoot })); }
    else await adapter.relayOne({ campaign, step, operationId, acknowledgement: imported.acknowledgement, privateDir: privateRoot });
    await assert.rejects(adapter.relayOne({ campaign, step, operationId, acknowledgement: imported.acknowledgement, privateDir: privateRoot }));
    const sent = relayCalls, observed = await adapter.observe({ campaign, step, operationId, privateDir: privateRoot }); assert.equal(observed.verified, true); assert.equal(relayCalls, sent);
    report.operations.push({ step, operationId, transactionHash: imported.transactionHash, status: observed.state, approvingRole: step < 5 ? 'synthetic-creator' : 'synthetic-governor' });
    console.log(`Alpha disposable operation ${step + 1}/7 verified.`);
    if (step === 5) { adapter = createAlphaAdapter(); check('New adapter instance resumes genuine durable session after binding one'); }
  }
  assert.equal(relayCalls, 7); check('Seven exact one-shot relays; lost response and duplicate calls never cause resubmission');
  const exported = await adapter.exportVerification({ campaign, step: 6, privateDir: privateRoot }); assert.equal(exported.tasks.length, 5); check('Genuine receipt-proven exporter revalidates all five creations and both governor bindings');
  assert.deepEqual(fs.readdirSync(coordinator.lockDirectory), []); check('Both actual sender locks released only after complete durable verified result');
  report.rawRelayRequests = relayCalls; report.readOnlyRequests = readCalls; report.passed = true; report.completedAt = new Date().toISOString();
  assert.deepEqual(codeHashes(), report.acceptanceCodeSha256, 'Acceptance implementation changed during its own run');
  fs.writeFileSync(output, JSON.stringify(report, null, 2) + '\n', { flag: 'wx' }); console.log('Alpha genuine adapter acceptance passed.');
} catch (error) {
  if (process.env.ALPHA_ACCEPT_PRIVATE_FAILURE) fs.writeFileSync(process.env.ALPHA_ACCEPT_PRIVATE_FAILURE, String(error.stack), { mode: 0o600 });
  report.passed = false; report.failure = { stage, code: error.code || 'ACCEPTANCE_STOPPED' }; fs.writeFileSync(output, JSON.stringify(report, null, 2) + '\n', { flag: 'wx' }); console.error('Alpha genuine adapter acceptance stopped.'); process.exitCode = 1;
} finally { if (server) await new Promise(resolve => server.close(resolve)); fs.rmSync(privateRoot, { recursive: true, force: true }); }
