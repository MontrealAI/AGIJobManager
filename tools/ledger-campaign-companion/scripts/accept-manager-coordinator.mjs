// Disposable native acceptance only. No public RPC, real wallet, old target or explorer service is used.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import https from 'node:https';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { Wallet, Transaction, keccak256 } from 'ethers';
import manager, { MANAGER_SUPPORTED } from '../coordinators/manager.mjs';
import { sha256, canonical, observeSource } from '../coordinators/common.mjs';
import { policyDigest } from '../src/envelope.mjs';

const root = process.env.MANAGER_ACCEPT_CHECKOUT, output = process.env.MANAGER_ACCEPT_REPORT;
assert.ok(root && path.isAbsolute(root) && output && path.isAbsolute(output));
const requireSource = createRequire(path.join(root, 'package.json'));
const P = requireSource(path.join(root, 'hardhat/scripts/core-creation-plan.cjs'));
const T = requireSource(path.join(root, 'hardhat/scripts/transaction-envelope.cjs'));
const C = requireSource(path.join(root, 'hardhat/scripts/qualified-build-catalog.cjs'));
const F = requireSource(path.join(root, 'hardhat/test/helpers/core-session-fixture.cjs'));
const { ethers, network } = await requireSource(path.join(root, 'hardhat/scripts/runtime.cjs')).getRuntime();
assert.equal((await ethers.provider.getNetwork()).chainId, 1n);
assert.equal(network.config.hardfork, 'osaka');
const local = ethers.provider, privateRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'manual-ledger-manager-accept-'));
const report = { schema: 'manual-ledger-genuine-manager-adapter-acceptance-v1', source: MANAGER_SUPPORTED, node: process.versions.node,
  scope: 'Unforked disposable Osaka with real source CLI subprocesses and synthetic signatures; finalized=latest and EIP1898 fixture adaptation are not public-provider or consensus proof',
  hardware: false, publicProvider: false, oldDeploymentTransactions: 0, activationAllowed: false, checks: [], operations: [] };
const companionRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const codeHashes = () => Object.fromEntries(['coordinators/common.mjs', 'coordinators/manager.mjs', 'scripts/accept-manager-coordinator.mjs'].map(name => [name, sha256(fs.readFileSync(path.join(companionRoot, name)))]));
report.acceptanceCodeSha256 = codeHashes();
const check = label => report.checks.push(label);
let server, rawRelayCalls = 0, readCalls = 0, loseResponse = false, corruptReceipt = false, stage = 'certificate';
function write(file, value) { fs.writeFileSync(file, JSON.stringify(value), { flag: 'wx', mode: 0o600 }); }
try {
  const cert = path.join(privateRoot, 'ca.pem'), key = path.join(privateRoot, 'key.pem');
  execFileSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-sha256', '-nodes', '-keyout', key, '-out', cert, '-days', '1', '-subj', '/CN=Manual Ledger disposable acceptance', '-addext', 'subjectAltName=IP:127.0.0.1', '-addext', 'basicConstraints=critical,CA:TRUE'], { stdio: 'ignore' });
  stage = 'fixture-compile'; const solc = requireSource('solc'), fixture = JSON.parse(solc.compile(JSON.stringify({ language: 'Solidity', sources: { 'Fixture.sol': { content: 'pragma solidity ^0.8.20; contract Fixture { function decimals() external pure returns(uint8){return 6;} function paused() external pure returns(bool){return false;} function isBlacklisted(address) external pure returns(bool){return false;} }' } }, settings: { evmVersion: 'shanghai', outputSelection: { '*': { '*': ['evm.deployedBytecode.object'] } } } })));
  const code = '0x' + fixture.contracts['Fixture.sol'].Fixture.evm.deployedBytecode.object;
  const registry = '0x2222222222222222222222222222222222222222';
  await local.send('hardhat_setCode', [F.config(Wallet.createRandom().address).constructorArgs.usdcTokenAddress, code]);
  await local.send('hardhat_setCode', [registry, code]);
  await local.send('hardhat_mine', ['0x1']);
  const creator = Wallet.createRandom(); await local.send('hardhat_setBalance', [creator.address, ethers.toQuantity(ethers.parseEther('10'))]);
  stage = 'source-observation'; const source = P.observedRevision(); assert.equal(source.commit, MANAGER_SUPPORTED.commit); assert.equal(source.tree, MANAGER_SUPPORTED.tree);
  stage = 'catalog';
  F.actualCatalog(privateRoot);
  const catalogPath = path.join(privateRoot, 'catalog.json'), catalog = JSON.parse(fs.readFileSync(catalogPath)), original = Object.values(catalog.builds)[0], buildId = 'disposable-current-source-real-artifacts-v1';
  original.source = source; catalog.builds = { [buildId]: original }; fs.writeFileSync(catalogPath, JSON.stringify(catalog));
  const catalogSha256 = sha256(fs.readFileSync(catalogPath)), qualified = C.loadQualifiedBuild({ catalogPath, catalogSha256, buildId, expectedRevision: source });
  stage = 'plan'; const block = await local.send('eth_getBlockByNumber', ['latest', false]), config = F.config(creator.address, { block: { number: Number(BigInt(block.number)), hash: block.hash }, registry });
  const plan = P.makePlan(config, qualified, source), planPath = path.join(privateRoot, 'plan.json'); write(planPath, plan);
  const allowed = new Set(['eth_chainId', 'eth_getCode', 'eth_getTransactionCount', 'eth_getBlockByNumber', 'eth_call', 'eth_estimateGas', 'eth_getTransactionByHash', 'eth_getTransactionReceipt']);
  stage = 'https-server'; server = https.createServer({ key: fs.readFileSync(key), cert: fs.readFileSync(cert), minVersion: 'TLSv1.2' }, (request, response) => {
    let size = 0; const chunks = [];
    request.on('data', bytes => { size += bytes.length; if (size > 262144) request.destroy(); else chunks.push(bytes); });
    request.on('end', async () => {
      try {
        assert.equal(request.method, 'POST'); const body = JSON.parse(Buffer.concat(chunks)); assert.equal(body.jsonrpc, '2.0');
        const relay = request.url === '/relay'; assert.ok(relay || request.url === '/read');
        assert.ok(relay ? body.method === 'eth_sendRawTransaction' : allowed.has(body.method));
        let params = body.params;
        if (body.method === 'eth_getBlockByNumber' && params[0] === 'finalized') params = ['latest', params[1]];
        const at = params.at(-1); let before;
        if (at?.requireCanonical) { before = await local.send('eth_getBlockByHash', [at.blockHash, false]); assert.ok(before); assert.equal((await local.send('eth_getBlockByNumber', [before.number, false])).hash, at.blockHash); params = [...params.slice(0, -1), before.number]; }
        let result = await local.send(body.method, params);
        if (corruptReceipt && body.method === 'eth_getTransactionReceipt' && result) result = { ...result, blockHash: '0x' + '12'.repeat(32) };
        if (before) assert.equal((await local.send('eth_getBlockByNumber', [before.number, false])).hash, at.blockHash);
        if (relay) { rawRelayCalls++; if (loseResponse) { loseResponse = false; request.socket.destroy(); return; } } else readCalls++;
        response.writeHead(200, { 'content-type': 'application/json' }); response.end(JSON.stringify({ jsonrpc: '2.0', id: body.id, result }));
      } catch { response.writeHead(400, { 'content-type': 'application/json' }); response.end('{"error":"Disposable fixture request rejected"}'); }
    });
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = `https://127.0.0.1:${server.address().port}`, lockDirectory = path.join(privateRoot, 'locks'); fs.mkdirSync(lockDirectory);
  const expiresAt = new Date(Date.now() + 3600000).toISOString(), sourceSha256 = '0x' + sha256(JSON.stringify(canonical({ source, buildId, catalogSha256, buildDigest: qualified.buildDigest })));
  const operations = plan.operations.map((operation, i) => {
    const unsignedHex = T.unsignedTransaction(operation.envelope).unsignedSerialized, expectedUnsignedHash = keccak256(unsignedHex), e = operation.envelope;
    const review = { chainId: '1', expectedSender: creator.address, expiresAt, maxGasLimit: e.gasLimit, maxFeePerGas: e.maxFeePerGas, maxPriorityFeePerGas: e.maxPriorityFeePerGas, maxTotalFeeWei: (BigInt(e.gasLimit) * BigInt(e.maxFeePerGas)).toString(), maxValueWei: '0', operationId: `manager-${i}`, sourceSha256 };
    return { operationId: review.operationId, unsignedHex, expectedUnsignedHash, expectedPolicyHash: policyDigest(review, expectedUnsignedHash), review };
  });
  const campaign = { expiresAt, reviewedManifest: { source: { repository: MANAGER_SUPPORTED.repository, commit: source.commit, tree: source.tree }, sourceSha256, planSha256: plan.payloadSha256, operations },
    coordinator: { checkout: root, nodePath: fs.realpathSync(process.execPath), nodeVersion: process.versions.node, nodeSha256: sha256(fs.readFileSync(fs.realpathSync(process.execPath))), planPath, sessionPath: path.join(privateRoot, 'session'), lockDirectory, catalogPath, catalogSha256, buildId, readRpcUrl: origin + '/read', relayRpcUrl: origin + '/relay', extraCaCertificates: cert, licenseType: '3' } };
  stage = 'inspect'; assert.equal(manager.inspectCampaign(campaign).route.decimals, 6); check('Actual plan derives USDC route, creator, governor, graph and fee wallet display');
  const unknown = structuredClone(campaign); unknown.reviewedManifest.source.commit = 'a'.repeat(40);
  assert.throws(() => manager.inspectCampaign(unknown), /UNREVIEWED_COORDINATOR_SOURCE/); check('Unknown source rejected before loading coordinator');
  for (let step = 0; step < 9; step++) {
    stage = `operation-${step}`; const operationId = operations[step].operationId, beforePrepare = rawRelayCalls;
    const prepared = await manager.prepare({ campaign, step, privateDir: privateRoot }); assert.equal(rawRelayCalls, beforePrepare);
    assert.equal(prepared.packet.index, step); assert.equal(prepared.prepared.unsignedHex, operations[step].unsignedHex);
    if (step === 0) {
      await assert.rejects(manager.prepare({ campaign, step, privateDir: privateRoot }), /RECOVERY_REQUIRED_EXISTING_SIGNING_INTENT/); check('Duplicate prepare refuses another signing request');
      const second = structuredClone(campaign); second.coordinator.sessionPath = path.join(privateRoot, 'second-session');
      await assert.rejects(manager.prepare({ campaign: second, step, privateDir: privateRoot })); assert.equal(rawRelayCalls, 0); check('Concurrent creator campaign blocked by genuine actor lock');
      for (const mutation of [{ nonce: 99 }, { value: 1 }, { chainId: 2 }, { gasLimit: 1000000 }, { maxFeePerGas: '11000000000' }, { maxPriorityFeePerGas: '2' }, { to: registry }, { data: '0x00' }, { accessList: [{ address: registry, storageKeys: [] }] }]) {
        const tx = Transaction.from(prepared.prepared.unsignedHex), raw = await creator.signTransaction({ ...tx.toJSON(), ...mutation });
        await assert.rejects(manager.importSigned({ campaign, step, operationId, raw, privateDir: privateRoot }), /SIGNED_CAPABILITY_MISMATCH/);
      }
      const wrong = await Wallet.createRandom().signTransaction(Transaction.from(prepared.prepared.unsignedHex));
      await assert.rejects(manager.importSigned({ campaign, step, operationId, raw: wrong, privateDir: privateRoot }), /SIGNED_CAPABILITY_MISMATCH/); check('Every material envelope field and recovered sender mismatch refused before import');
    }
    const raw = await creator.signTransaction(Transaction.from(prepared.prepared.unsignedHex));
    const imported = await manager.importSigned({ campaign, step, operationId, raw, privateDir: privateRoot }); assert.equal(imported.transactionHash, keccak256(raw));
    const reads = rawRelayCalls; if (step === 0) { const unresolved = await manager.observe({ campaign, step, operationId, privateDir: privateRoot }); assert.equal(unresolved.verified, false); assert.equal(rawRelayCalls, reads); check('Receipt absence neither submits nor advances'); loseResponse = true; }
    if (step === 0) await assert.rejects(manager.relayOne({ campaign, step, operationId, acknowledgement: imported.acknowledgement, privateDir: privateRoot }));
    else await manager.relayOne({ campaign, step, operationId, acknowledgement: imported.acknowledgement, privateDir: privateRoot });
    await assert.rejects(manager.relayOne({ campaign, step, operationId, acknowledgement: imported.acknowledgement, privateDir: privateRoot }));
    const sent = rawRelayCalls, observed = await manager.observe({ campaign, step, operationId, privateDir: privateRoot }); assert.equal(observed.verified, true); assert.equal(observed.finalized, true); assert.equal(rawRelayCalls, sent);
    const again = await manager.observe({ campaign, step, operationId, privateDir: privateRoot }); assert.equal(again.verified, true); assert.equal(rawRelayCalls, sent);
    report.operations.push({ step, operationId, transactionHash: imported.transactionHash, status: observed.state, canonicalReobserved: true });
  }
  assert.equal(rawRelayCalls, 9); check('Nine exact one-shot coordinator relay calls; lost-response recovery never resubmits');
  const completion = await manager.observe({ campaign, step: 8, operationId: 'manager-8', privateDir: privateRoot }); assert.equal(completion.boundedCampaignComplete, true); assert.equal(completion.configurationComplete, false);
  const contract = new ethers.Contract(plan.operations[8].predictedAddress, qualified.records.AGIJobManager.artifact.abi, local);
  assert.equal(await contract.owner(), P.GOVERNOR); assert.equal(await contract.paused(), true); assert.equal(await contract.pendingOwner(), ethers.ZeroAddress); assert.equal(await contract.ensJobPages(), ethers.ZeroAddress); check('Actual Manager paused, explicit d76 governor, zero pending owner and unconfigured ENS pages');
  const exported = await manager.exportVerification({ campaign, step: 8, privateDir: privateRoot }); assert.equal(exported.tasks.length, 9); assert.ok(exported.tasks.every(x => x.creation.runtimeVerified && x.creation.finalized && /^v\d+\.\d+\.\d+\+commit\.[a-f0-9]{8}$/.test(x.compilerVersion))); check('Native offline export preserved plus independently reverified nine runtime/receipt task bindings');
  corruptReceipt = true; await assert.rejects(manager.observe({ campaign, step: 8, operationId: 'manager-8', privateDir: privateRoot })); corruptReceipt = false;
  assert.equal(rawRelayCalls, 9); check('Changed canonical receipt blocks even previously verified campaign and never submits');
  const savedCatalog = fs.readFileSync(catalogPath); fs.appendFileSync(catalogPath, '\n');
  try { await assert.rejects(manager.observe({ campaign, step: 8, operationId: 'manager-8', privateDir: privateRoot })); } finally { fs.writeFileSync(catalogPath, savedCatalog); }
  check('Catalog/build drift blocks fresh observation before any new effect');
  report.readOnlyRequests = readCalls; report.rawRelayRequests = rawRelayCalls; report.passed = true; report.completedAt = new Date().toISOString();
  observeSource(campaign.coordinator, MANAGER_SUPPORTED);
  assert.deepEqual(codeHashes(), report.acceptanceCodeSha256, 'Acceptance implementation changed during its own run');
  fs.writeFileSync(output, JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
  console.log('Manager genuine coordinator adapter acceptance passed; sanitized report written.');
} catch (error) {
  if (process.env.MANAGER_ACCEPT_PRIVATE_FAILURE) fs.writeFileSync(process.env.MANAGER_ACCEPT_PRIVATE_FAILURE, String(error.stack), { mode: 0o600 });
  report.passed = false; report.failure = { stage, code: error.code || 'ACCEPTANCE_STOPPED', message: /^[A-Z0-9_ :.-]+$/.test(error.message) ? error.message : 'Acceptance stopped; inspect private local fixture without publishing capabilities' };
  fs.writeFileSync(output, JSON.stringify(report, null, 2) + '\n', { flag: 'wx' }); console.error('Manager genuine coordinator acceptance stopped.'); process.exitCode = 1;
} finally { if (server) await new Promise(resolve => server.close(resolve)); fs.rmSync(privateRoot, { recursive: true, force: true }); }
