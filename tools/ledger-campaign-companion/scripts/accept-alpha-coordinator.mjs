// Synthetic local acceptance. This script is never imported by either browser or production server.
import fs from 'node:fs';
import { acceptanceTrustedContext, acceptanceAuthority } from './accept-local-trust.mjs';
import path from 'node:path';
import os from 'node:os';
import https from 'node:https';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { Wallet, Transaction, keccak256, ZeroAddress } from 'ethers';
import { createAlphaAdapter, ALPHA_SUPPORTED, ALPHA_CURRENT } from '../coordinators/alpha.mjs';
import { execute, observeSource, sha256, canonical, privateWrite, readJson } from '../coordinators/common.mjs';
import { policyDigest, attachAndValidateSignature } from '../src/envelope.mjs';
import { prepareVerificationTask } from '../verification/explorer.mjs';
import { createCampaignEngine } from '../bridge/campaign-engine.mjs';


const ALPHA_ACCEPT_PROFILE = process.env.ALPHA_ACCEPT_PROFILE || 'legacy';
assert.ok(['legacy', 'current'].includes(ALPHA_ACCEPT_PROFILE));
const SUPPORTED = ALPHA_ACCEPT_PROFILE === 'current' ? ALPHA_CURRENT : ALPHA_SUPPORTED;
const root = process.env.ALPHA_ACCEPT_CHECKOUT, output = process.env.ALPHA_ACCEPT_REPORT;
assert.ok(root && path.isAbsolute(root) && output && path.isAbsolute(output));
observeSource({ checkout: root }, SUPPORTED);
const sourceRequire = createRequire(path.join(root, 'tests/contracts/package.json'));
const { ethers, network } = sourceRequire('hardhat');
assert.equal(network.config.chainId, 1); assert.equal(network.config.hardfork, 'osaka');
const privateRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'manual-ledger-alpha-accept-'));
const report = { schema: 'manual-ledger-genuine-alpha-adapter-acceptance-v1', source: SUPPORTED, node: process.versions.node,
  scope: 'Unforked disposable Osaka, synthetic keys and mock dependencies, normal child-scoped local TLS, finalized=latest; not physical Ledger/public-provider/finality qualification',
  hardware: false, publicProvider: false, oldDeploymentTransactions: 0, activationAllowed: false, checks: [], operations: [] };
const companionRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const codeHashes = () => Object.fromEntries(['coordinators/common.mjs', 'coordinators/alpha.mjs', 'verification/configuration.mjs', 'verification/explorer.mjs', 'verification/runtime.mjs', 'coordinators/runtime-evidence.mjs', 'coordinators/native-runtime-snapshot.cjs', 'bridge/campaign-engine.mjs', 'bridge/private-store.mjs', 'trust/local-build.mjs', 'trust/prepare-review.mjs', 'trust/soljson-driver.cjs', 'verification/authority.mjs', 'scripts/accept-local-trust.mjs', 'scripts/accept-alpha-coordinator.mjs'].map(name => [name, sha256(fs.readFileSync(path.join(companionRoot, name)))]));
report.acceptanceCodeSha256 = codeHashes();
let server, engine, stage = 'fixture', relayCalls = 0, readCalls = 0, loseResponse = false;
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
  await execute(coordinator, SUPPORTED, path.join(root, 'tests/contracts/scripts/mainnet-authority.js'), ['plan', plannerConfig, planPath]); const plan = readJson(planPath);
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
  const campaign = { expiresAt, reviewedManifest: { source: { repository: SUPPORTED.repository, commit: SUPPORTED.commit, tree: SUPPORTED.tree }, sourceSha256, planSha256: plan.payloadSha256, operations }, coordinator };
  Object.assign(campaign, { format: 'manual-ledger-campaign-v1', campaignId: 'synthetic-alpha-acceptance', adapter: 'alpha', packetSchema: SUPPORTED.packetSchema, network: { chainId: '1' }, route: { token: plan.config.dependencies.token.address, symbol: 'AGIALPHA', decimals: 18 }, actors: { creator: creator.address, governor: governor.address, feeRecipients: [], treasuries: [] }, maxTotalFeeWei: envelopes.reduce((sum, envelope) => sum + BigInt(envelope.gasLimit) * BigInt(envelope.maxFeePerGas), 0n).toString(),
    operations: operations.map((operation, index) => ({ index, account: index < 5 ? 'creator' : 'governor', destination: envelopes[index].to || 'CREATE', dependsOn: index ? [index - 1] : [] })), relayPolicy: { enabled: true, acknowledgementMode: 'EXACT_COORDINATOR_PER_STEP' } });
  let adapter = createAlphaAdapter(); assert.equal(adapter.inspectCampaign(campaign).route.decimals, 18); check('Actual sealed plan supplies separate AGIALPHA route and creator/governor roles');
  const pinnedAdapter = adapter.forCampaign(campaign);
  let lostImportResponse = true, actualImports = 0;
  const lostImportAdapter = Object.freeze({ ...pinnedAdapter, async importSigned(request) { actualImports++; const result = await pinnedAdapter.importSigned(request); if (lostImportResponse) { lostImportResponse = false; throw Error('SYNTHETIC_LOST_NATIVE_IMPORT_RESPONSE'); } return result; } });
  engine = await createCampaignEngine({ campaign, adapter: lostImportAdapter, privateDirectory: path.join(privateRoot, 'bridge'), relayEnabled: true });
  for (let step = 0; step < 7; step++) {
    stage = `operation-${step}`; const operationId = operations[step].operationId, before = relayCalls;
    const prepared = step === 0 ? await engine.prepare({ step }) : await adapter.prepare({ campaign, step, privateDir: privateRoot }); assert.equal(relayCalls, before); assert.equal(prepared.prepared.unsignedHex, operations[step].unsignedHex);
    if (step === 0) {
      await assert.rejects(adapter.prepare({ campaign, step, privateDir: privateRoot }), /RECOVERY_REQUIRED_EXISTING_SIGNING_INTENT/); check('Duplicate signing request stops on existing durable intent');
      const wrong = await Wallet.createRandom().signTransaction(Transaction.from(prepared.prepared.unsignedHex));
      await assert.rejects(adapter.importSigned({ campaign, step, operationId, raw: wrong, privateDir: privateRoot }), /SIGNED_CAPABILITY_MISMATCH/); check('Wrong actual account fails before any coordinator import');
    }
    const signer = step < 5 ? creator : governor, raw = await signer.signTransaction(Transaction.from(prepared.prepared.unsignedHex));
    let imported;
    if (step === 0) {
      const unsignedObservation = await engine.observe({ step, operationId }); assert.equal(unsignedObservation.verified, false); assert.equal(relayCalls, before);
      await engine.close(); engine = await createCampaignEngine({ campaign, adapter: lostImportAdapter, privateDirectory: path.join(privateRoot, 'bridge'), relayEnabled: true });
      await assert.rejects(engine.prepare({ step })); check('Actual unsigned native handoff survives bridge restart without another signing request or submission');
      const capability = attachAndValidateSignature(prepared.prepared, Transaction.from(raw).signature);
      await assert.rejects(engine.importSigned({ step, operationId, capability })); assert.equal(actualImports, 1);
      await assert.rejects(engine.importSigned({ step, operationId, capability })); assert.equal(actualImports, 1);
      await engine.close(); engine = await createCampaignEngine({ campaign, adapter: pinnedAdapter, privateDirectory: path.join(privateRoot, 'bridge'), relayEnabled: true });
      imported = await engine.observe({ step, operationId }); assert.equal(imported.state, 'signed'); assert.equal(typeof imported.acknowledgement, 'string');
      check('Successful actual native import with lost response preserves exact capability and restores only original acknowledgement after restart, without reimport');
    } else imported = await adapter.importSigned({ campaign, step, operationId, raw, privateDir: privateRoot });
    assert.equal(imported.transactionHash, keccak256(raw));
    if (step === 0) { loseResponse = true; await assert.rejects(engine.relayOne({ step, operationId, acknowledgement: imported.acknowledgement })); }
    else await adapter.relayOne({ campaign, step, operationId, acknowledgement: imported.acknowledgement, privateDir: privateRoot });
    if (step === 0) await assert.rejects(engine.relayOne({ step, operationId, acknowledgement: imported.acknowledgement })); else await assert.rejects(adapter.relayOne({ campaign, step, operationId, acknowledgement: imported.acknowledgement, privateDir: privateRoot }));
    if (step === 0) { await engine.close(); engine = await createCampaignEngine({ campaign, adapter: pinnedAdapter, privateDirectory: path.join(privateRoot, 'bridge'), relayEnabled: true }); check('Exact persisted relay attempt survives restart before canonical receipt reconciliation'); }
    const sent = relayCalls, observed = step === 0 ? await engine.observe({ step, operationId }) : await adapter.observe({ campaign, step, operationId, privateDir: privateRoot }); assert.equal(observed.verified, true); assert.equal(relayCalls, sent);
    report.operations.push({ step, operationId, transactionHash: imported.transactionHash, status: observed.state, approvingRole: step < 5 ? 'synthetic-creator' : 'synthetic-governor' });
    console.log(`Alpha disposable operation ${step + 1}/7 verified.`);
    if (step === 0) { await engine.close(); engine = null; report.genuineEngineFacadeOperations = 1; check('Actual engine facade persists signing request and full capability before exact coordinator relay/recovery'); }
    if (step === 5) { adapter = createAlphaAdapter(); check('New adapter instance resumes genuine durable session after binding one'); }
  }
  assert.equal(relayCalls, 7); check('Seven exact one-shot relays; lost response and duplicate calls never cause resubmission');
  const exported = await adapter.exportVerification({ campaign, step: 6, privateDir: privateRoot }); assert.equal(exported.tasks.length, 5); check('Genuine receipt-proven exporter revalidates all five creations and both governor bindings');
  report.verificationTasks = exported.tasks.map(({ standardInput, ...task }) => task); if (exported.runtimeEvidence) report.runtimeEvidence = exported.runtimeEvidence;
  for (const task of exported.tasks) prepareVerificationTask(task); report.explorerOfflineTasksValidated = exported.tasks.length; check('All five genuine exported tasks accepted by strict explorer package validator without service calls');
  assert.deepEqual(fs.readdirSync(coordinator.lockDirectory), []); check('Both actual sender locks released only after complete durable verified result');
  if (SUPPORTED.runtimeEvidenceRequired) {
    stage = 'd76-local-trusted-plan-and-initial-state';
    const P = sourceRequire(path.join(root, 'tests/contracts/scripts/mainnet-authority.js')), productionGovernor = '0xd76AD27a1Bcf8652e7e46BE603FA742FD1c10A99';
    const freshCreator = Wallet.createRandom().connect(ethers.provider); await (await sponsor.sendTransaction({ to: freshCreator.address, value: ethers.parseEther('20') })).wait();
    const pin = await ethers.provider.send('eth_getBlockByNumber', ['latest', false]), d76Config = structuredClone(config);
    Object.assign(d76Config, { deployer: freshCreator.address, nonce: 0, block: { number: Number(BigInt(pin.number)), hash: pin.hash }, governor: { kind: 'ledger-eoa', address: productionGovernor, addressAcknowledgement: productionGovernor } });
    const d76Journal = { ...structuredClone(journal), journalId: 'SYNTHETIC-D76-UNCOMMISSIONED-ACCEPTANCE', sender: freshCreator.address, block: d76Config.block };
    const revision = sourceRequire(path.join(root, 'tests/contracts/scripts/authority-revision.js')).reviewedRevision();
    const d76Plan = await P.makePlan(d76Config, P.compiledContracts(), revision, d76Journal), d76PlanPath = privateWrite(privateRoot, d76Plan);
    const d76SourceSha256 = '0x' + sha256(JSON.stringify(canonical({ revision, contracts: d76Plan.contracts, builds: d76Plan.builds })));
    const d76Envelopes = [...d76Plan.transactions.map(operation => operation.envelope), ...d76Plan.governanceCalls.map((operation, index) => ({ type: 2, chainId: 1, from: productionGovernor, nonce: index, to: operation.to, value: '0', data: operation.data, gasLimit: '1000000', maxFeePerGas: '10000000000', maxPriorityFeePerGas: '1000000000', accessList: [] }))];
    const d76Operations = d76Envelopes.map((envelope, index) => {
      const { from, ...fields } = envelope, unsignedHex = Transaction.from(fields).unsignedSerialized, expectedUnsignedHash = keccak256(unsignedHex);
      const review = { chainId: '1', expectedSender: from, expiresAt, maxGasLimit: envelope.gasLimit, maxFeePerGas: envelope.maxFeePerGas, maxPriorityFeePerGas: envelope.maxPriorityFeePerGas, maxTotalFeeWei: (BigInt(envelope.gasLimit) * BigInt(envelope.maxFeePerGas)).toString(), maxValueWei: '0', operationId: `alpha-d76-unsigned-${index}`, sourceSha256: d76SourceSha256 };
      return { operationId: review.operationId, unsignedHex, expectedUnsignedHash, expectedPolicyHash: policyDigest(review, expectedUnsignedHash), review };
    });
    const d76Campaign = structuredClone(campaign); d76Campaign.campaignId = 'synthetic-d76-uncommissioned-local-trust';
    d76Campaign.actors = { ...d76Campaign.actors, creator: freshCreator.address, governor: productionGovernor };
    d76Campaign.coordinator = { ...d76Campaign.coordinator, planPath: d76PlanPath, sessionPath: path.join(privateRoot, 'd76-unstarted-session.jsonl') };
    d76Campaign.reviewedManifest = { ...d76Campaign.reviewedManifest, planSha256: d76Plan.payloadSha256, sourceSha256: d76SourceSha256, operations: d76Operations };
    d76Campaign.operations = d76Operations.map((operation, index) => ({ index, account: index < 5 ? 'creator' : 'governor', destination: d76Envelopes[index].to || 'CREATE', dependsOn: index ? [index - 1] : [] }));
    adapter.inspectCampaign(d76Campaign);
    const trustedContext = acceptanceTrustedContext({ campaign: d76Campaign, supported: SUPPORTED, privateRoot });
    assert.equal(trustedContext.receipt.operations.length, 7); report.localTrustedD76UnsignedBuild = trustedContext.receipt;
    check('Separate exact current Alpha d76 native plan and all seven unsigned transaction bytes independently recompiled and bound locally; no d76 signature or binding execution');
    const creationHashes = [], expected = P.expectedState(d76Plan, 0);
    for (const operation of d76Plan.transactions) {
      const { from, ...envelope } = operation.envelope, tx = await freshCreator.sendTransaction(envelope); await tx.wait(); creationHashes.push(tx.hash);
      assert.equal((await ethers.provider.getCode(operation.expectedAddress)).toLowerCase(), P.expectedRuntime(d76Plan.contracts[operation.name], expected[operation.name]).toLowerCase());
    }
    report.d76Uncommissioned = { scope: 'Separate fresh disposable five-CREATE d76 constructor graph; two governor binding transactions unsigned and unexecuted; no physical or production evidence',
      governor: productionGovernor, creator: freshCreator.address, creationHashes, governorSignatures: 0, governorBindingSubmissions: 0, activationAuthorized: false,
      authority: await acceptanceAuthority({ adapter: 'alpha', source: d76Campaign.reviewedManifest.source, graph: d76Plan.addresses, creator: freshCreator.address, governor: productionGovernor, provider: ethers.provider }) };
    const pending = new Set(['AscensionRiskOracle.marketplace', 'AscensionJobMarket.mark']);
    const observations = report.d76Uncommissioned.authority.observations;
    assert.equal(observations.filter(row => pending.has(row.id)).length, 2);
    assert.ok(observations.every(row => pending.has(row.id) ? row.observed === ZeroAddress && row.state === 'mismatch' : row.state === 'match'));
    report.d76Uncommissioned.initialStateMatches = true; report.d76Uncommissioned.requiredGovernorBindings = [...pending];
    check('Actual d76 uncommissioned Alpha five-contract runtime/ownership/no-admission state observed; exact two zero bindings remain explicitly pending and no global pause is claimed');
  }
  report.rawRelayRequests = relayCalls; report.readOnlyRequests = readCalls; report.passed = true; report.completedAt = new Date().toISOString();
  assert.deepEqual(codeHashes(), report.acceptanceCodeSha256, 'Acceptance implementation changed during its own run');
  fs.writeFileSync(output, JSON.stringify(report, null, 2) + '\n', { flag: 'wx' }); console.log('Alpha genuine adapter acceptance passed.');
} catch (error) {
  if (process.env.ALPHA_ACCEPT_PRIVATE_FAILURE) fs.writeFileSync(process.env.ALPHA_ACCEPT_PRIVATE_FAILURE, String(error.stack), { mode: 0o600 });
  report.passed = false; report.failure = { stage, code: error.code || 'ACCEPTANCE_STOPPED' }; fs.writeFileSync(output, JSON.stringify(report, null, 2) + '\n', { flag: 'wx' }); console.error('Alpha genuine adapter acceptance stopped.'); process.exitCode = 1;
} finally { if (engine) await engine.close(); if (server) await new Promise(resolve => server.close(resolve)); fs.rmSync(privateRoot, { recursive: true, force: true }); }
