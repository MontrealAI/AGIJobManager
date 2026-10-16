'use strict';
// Explicit disposable EVM only. This is never selected by terminal.cjs.
const fs = require('node:fs'), path = require('node:path'), os = require('node:os'), https = require('node:https'), tls = require('node:tls'), crypto = require('node:crypto'), cp = require('node:child_process'), { createRequire } = require('node:module'), { pathToFileURL } = require('node:url'), assert = require('node:assert/strict');
const { loadNative } = require('../native.cjs'), { review, sendOne } = require('../send.cjs'), { connectHardhat } = require('../hardhat.cjs'), { GOVERNOR, sha, writeNew, sourceGuard } = require('../safety.cjs');

async function main() {
  const [authorization, managerRoot, alphaRoot, jobsRoot, output] = process.argv.slice(2);
  assert(['--disposable-only', '--disposable-cli-only'].includes(authorization)); assert.equal(process.version, 'v22.23.3');
  assert(managerRoot && alphaRoot && jobsRoot && output && !fs.existsSync(output));
  for (const key of ['NODE_PATH', 'NODE_OPTIONS', 'HARDHAT_CONFIG', 'DEBUG', 'HARDHAT_VERBOSE', 'NODE_V8_COVERAGE']) delete process.env[key];
  process.umask(0o077); fs.mkdirSync(output, { mode: 0o700 });
  const privateRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ubuntu-hardhat-disposable-'));
  const req = createRequire(path.join(managerRoot, 'package.json')), E = req('ethers');
  const { createHardhatRuntimeEnvironment } = await import(pathToFileURL(req.resolve('hardhat/hre')).href);
  const hre = await createHardhatRuntimeEnvironment({ networks: { local: { type: 'edr-simulated', chainType: 'l1', chainId: 1, hardfork: 'osaka', blockGasLimit: 30000000, allowUnlimitedContractSize: false, accounts: [] } } }, {}, managerRoot);
  const connection = await hre.network.create('local');
  const backend = (method, params) => connection.provider.request({ method, params });
  let server, runtime;
  const metrics = { localOnly: true, publicProviderCalls: 0, realKeys: false, governorSignatures: 0, finality: 'synthetic finalized=latest', eip1898: 'canonical hash verified then adapted to numbered local EDR read', backendSubmissions: 0, reports: [] };
  // Only this isolated fixture adapts canonical tags/finality. Production never does.
  const rpc = async (method, params) => {
    params = [...params];
    if (method === 'eth_getBlockByNumber' && params[0] === 'finalized') params[0] = 'latest';
    for (let i = 0; i < params.length; i++) if (params[i]?.blockHash) {
      const block = await backend('eth_getBlockByHash', [params[i].blockHash, false]);
      assert(block && (await backend('eth_getBlockByNumber', [block.number, false])).hash === block.hash); params[i] = block.number;
    }
    if (method === 'eth_sendRawTransaction') metrics.backendSubmissions++;
    return backend(method, params);
  };
  try {
    const cert = path.join(privateRoot, 'tls.crt'), certKey = path.join(privateRoot, 'tls.key');
    cp.execFileSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-sha256', '-nodes', '-keyout', certKey, '-out', cert, '-days', '1', '-subj', '/CN=Disposable Ubuntu Hardhat fixture', '-addext', 'subjectAltName=IP:127.0.0.1'], { stdio: 'ignore' });
    server = https.createServer({ key: fs.readFileSync(certKey), cert: fs.readFileSync(cert) }, (request, response) => {
      let bytes = ''; request.setEncoding('utf8'); request.on('data', b => { bytes += b; }); request.on('end', async () => {
        let message; try { message = JSON.parse(bytes); const result = await rpc(message.method, message.params); response.end(JSON.stringify({ jsonrpc: '2.0', id: message.id, result })); }
        catch { response.end(JSON.stringify({ jsonrpc: '2.0', id: message?.id, error: { code: -32000, message: 'Disposable fixture read refused' } })); }
      });
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const url = `https://127.0.0.1:${server.address().port}`;
    // Local test CA only; no TLS disable flag, production remains normally verified.
    tls.setDefaultCACertificates([...tls.getCACertificates('default'), fs.readFileSync(cert, 'utf8')]);
    runtime = await connectHardhat(managerRoot, url);
    const source = `pragma solidity ^0.8.20; contract Six { function decimals() external pure returns(uint8){return 6;} function paused() external pure returns(bool){return false;} function isBlacklisted(address) external pure returns(bool){return false;} } contract Eighteen { function decimals() external pure returns(uint8){return 18;} } contract Ens { function owner(bytes32) external pure returns(address){return ${GOVERNOR};} function isApprovedForAll(address,address) external pure returns(bool){return false;} }`;
    const build = JSON.parse(req('solc').compile(JSON.stringify({ language: 'Solidity', sources: { 'Disposable.sol': { content: source } }, settings: { evmVersion: 'shanghai', outputSelection: { '*': { '*': ['evm.deployedBytecode.object'] } } } })));
    assert(!build.errors?.some(e => e.severity === 'error'));
    const code = name => '0x' + build.contracts['Disposable.sol'][name].evm.deployedBytecode.object;
    const USDC = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', TOKEN = '0xA61a3B3a130a9c20768EEBF97E21515A6046a1fA', ENS = '0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e', WRAPPER = '0xD4416b13d2b3a9aBae7AcD5D6C2BbDBE25686401';
    for (const [address, name] of [[USDC, 'Six'], [TOKEN, 'Eighteen'], [ENS, 'Ens'], [WRAPPER, 'Ens']]) await backend('hardhat_setCode', [address, code(name)]);
    await backend('hardhat_mine', ['0x1']);
    async function actor() { const key = crypto.randomBytes(32), address = new E.Wallet(new E.SigningKey(key)).address; await backend('hardhat_setBalance', [address, E.toQuantity(E.parseEther('100'))]); return { key, address }; }
    async function execute(c, count, a, afterEach, beforeEach) {
      const hashes = [];
      for (let i = 0; i < count; i++) {
        if (beforeEach) await beforeEach(i);
        const native = await loadNative(c, runtime), op = await native.prepare(), expectedReview = review(native, op, E);
        assert.equal(op.index, i);
        const key = Buffer.from(a.key), result = await sendOne({ runtime, native, expectedReview, assertInputs() {}, prompt: async () => key });
        assert(key.every(b => !b)); hashes.push(result.transactionHash);
        await native.reconcile(); if (afterEach) await afterEach(i);
      }
      a.key.fill(0); return hashes;
    }
    // All nine exact Manager native plans, linked libraries, receipts and runtime proofs.
    const mr = createRequire(path.join(managerRoot, 'package.json')), P = mr('./hardhat/scripts/core-creation-plan.cjs'), S = mr('./hardhat/scripts/deployment-session.cjs');
    const { prepareCoreCatalog } = await import(pathToFileURL(path.join(managerRoot, 'scripts/qualification/prepare-core-catalog.mjs')).href);
    const catalog = prepareCoreCatalog({ sourceRoot: managerRoot, outputDirectory: path.join(privateRoot, 'catalog'), expectedCommit: P.observedRevision().commit, expectedTree: P.observedRevision().tree, buildId: 'ubuntu-disposable-d371' });
    const a = await actor(), block = await rpc('eth_getBlockByNumber', ['latest', false]);
    const config = { schema: 'manager-core-creation-config-v1', chainId: 1, creator: a.address, governor: GOVERNOR, governorAcknowledgement: GOVERNOR, nonce: 0, block: { number: Number(BigInt(block.number)), hash: block.hash }, expiresAfterBlock: Number(BigInt(block.number)) + 2048,
      constructorArgs: { usdcTokenAddress: USDC, baseIpfsUrl: 'ipfs://disposable-ubuntu-test/', ensConfig: [ENS, E.ZeroAddress], rootNodes: ['club.agi.eth', 'agent.agi.eth', 'alpha.club.agi.eth', 'alpha.agent.agi.eth'].map(E.namehash), merkleRoots: [E.ZeroHash, E.ZeroHash], settlementWallets: ['0x3333333333333333333333333333333333333333', '0x4444444444444444444444444444444444444444'], initialGovernor: GOVERNOR }, creatorPolicy: { mode: 'empty-eoa-direct-create.v1' }, qualificationEvidence: null,
      envelopes: P.NAMES.map(name => ({ gasLimit: name === 'AGIJobManager' ? '8000000' : '1200000', maxFeePerGas: '10000000000', maxPriorityFeePerGas: '1000000000' })), maximumTotalFeeWei: '176000000000000000' };
    const plan = P.makePlan(config, catalog.qualified, P.observedRevision()), planFile = path.join(privateRoot, 'manager-plan.json'), sessionPath = path.join(privateRoot, 'manager-session'), locks = path.join(privateRoot, 'manager-locks'); writeNew(planFile, plan); fs.mkdirSync(locks);
    await S.initialize({ plan, qualified: catalog.qualified, source: P.observedRevision(), revalidateSource: P.createSourceGuard().assertUnchanged, directory: sessionPath, lockDirectory: locks, rpc });
    if (authorization === '--disposable-cli-only') {
      const { cliRoundTrip } = require('./cli-round-trip.cjs');
      const result = await cliRoundTrip({ config: { project: 'manager', checkout: managerRoot, planFile, sessionPath, catalogPath: catalog.catalogPath, catalogSha256: catalog.catalogSha256, buildId: catalog.buildId }, privateRoot, managerRoot, url, cert, key: a.key });
      assert.equal(metrics.backendSubmissions, 1); metrics.status = 'PASS'; metrics.reports.push({ project: 'manager', operations: 1, ...result }); writeNew(path.join(output, 'qualification.json'), metrics); console.log('Disposable CLI: review, real hidden-terminal send and native reconciliation passed.'); return;
    }
    const managerHashes = await execute({ project: 'manager', checkout: managerRoot, planFile, sessionPath, catalogPath: catalog.catalogPath, catalogSha256: catalog.catalogSha256, buildId: catalog.buildId }, 9, a);
    const completed = await S.complete({ directory: sessionPath, qualified: catalog.qualified, source: P.observedRevision(), revalidateSource: P.createSourceGuard().assertUnchanged, rpc }); assert.equal(completed.status, 'CORE_CREATED_PAUSED_CONFIGURATION_SEPARATE');
    const manager = new E.Contract(plan.operations[8].predictedAddress, ['function owner() view returns(address)', 'function pendingOwner() view returns(address)', 'function moderators(address) view returns(bool)', 'function paused() view returns(bool)'], runtime.provider);
    assert.equal(await manager.owner(), GOVERNOR); assert.equal(await manager.pendingOwner(), E.ZeroAddress); assert.equal(await manager.moderators(a.address), false); assert.equal(await manager.paused(), true);
    metrics.reports.push({ project: 'manager', source: sourceGuard(managerRoot, 'manager').commit, operations: managerHashes.length, creations: 9, nativeCompletion: completed.status, governor: GOVERNOR, deployerPrivileges: 'constructor governor; pending owner zero; deployer moderator false; native exact runtime/state verification passed', explorerAccepted: false });
    console.log('Disposable Manager: 9 exact terminal-signed operations and native completion passed.');
    // Five exact Alpha creations, with d76 constructor governor and no governor key.
    const ar = createRequire(path.join(alphaRoot, 'package.json')), AP = ar('./tests/contracts/scripts/mainnet-authority.js'), AS = ar('./tests/contracts/scripts/authority-session.js'), revision = ar('./tests/contracts/scripts/authority-revision.js').reviewedRevision();
    const aa = await actor(), ab = await rpc('eth_getBlockByNumber', ['latest', false]);
    const ac = { schema: 'agialpha.mainnet.config.v2', chainId: 1, deployer: aa.address, nonce: 0, block: { number: Number(BigInt(ab.number)), hash: ab.hash }, governor: { kind: 'ledger-eoa', address: GOVERNOR, addressAcknowledgement: GOVERNOR }, dependencies: Object.fromEntries(Object.entries({ token: TOKEN, ens: ENS, wrapper: WRAPPER }).map(([k, address]) => [k, { address, codeHash: E.keccak256(k === 'token' ? code('Eighteen') : code('Ens')) }])), rootOwners: Object.fromEntries(['alpha.agi.eth', 'alpha.agent.agi.eth', 'alpha.club.agi.eth'].map(n => [n, GOVERNOR])), parameters: { minimumValidatorStake: '10000000000000000000', minimumAgentStake: '10000000000000000000', quorum: 2, maximumRiskBps: 2000 }, sender: { mode: AP.EMPTY }, envelope: { gasLimit: '8000000', maxFeePerGas: '10000000000', maxPriorityFeePerGas: '1000000000', accessList: [] } };
    const journal = { schema: 'ethereum.cross-project-nonce-journal.v1', journalId: 'ubuntu-disposable', revision: 1, chainId: 1, sender: aa.address, scope: ['alpha', 'jobs', 'manager'], block: ac.block, latestNonce: 0, pendingNonce: 0, allocations: [{ project: 'alpha', startNonce: 0, count: 5 }, { project: 'jobs', startNonce: 5, count: 1 }, { project: 'manager', startNonce: 6, count: 1 }] };
    const alphaPlan = await AP.makePlan(ac, AP.compiledContracts(), revision, journal), alphaFile = path.join(privateRoot, 'alpha-plan.json'), alphaSession = path.join(privateRoot, 'alpha-session.json'), alphaLocks = path.join(privateRoot, 'alpha-locks'); writeNew(alphaFile, alphaPlan); fs.mkdirSync(alphaLocks);
    await AS.startSession({ plan: alphaPlan, revision, directory: alphaLocks, filename: alphaSession, mode: 'external-broadcast', rpc });
    const alphaHashes = await execute({ project: 'alpha', checkout: alphaRoot, planFile: alphaFile, sessionPath: alphaSession }, 5, aa);
    const alphaPrefix = await AP.preflight(alphaPlan, rpc, revision, alphaHashes, alphaPlan.journal, []); assert.equal(alphaPrefix.nextOperation.index, 5);
    for (const name of AP.OWNED) { const c = new E.Contract(alphaPlan.addresses[name], ['function owner() view returns(address)', 'function pendingOwner() view returns(address)'], runtime.provider); assert.equal(await c.owner(), GOVERNOR); assert.equal(await c.pendingOwner(), E.ZeroAddress); }
    metrics.reports.push({ project: 'alpha', source: revision.commit, operations: alphaHashes.length, creations: 5, governor: GOVERNOR, governorBindings: 0, nativePrefixPassed: true, globallyPaused: false, uncommissioned: true, explorerAccepted: false });
    console.log('Disposable Alpha: 5 exact terminal-signed creations; governor ownership and uncommissioned prefix passed.');
    const { rehearseJobs } = require('./staged-jobs.cjs');
    metrics.reports.push(await rehearseJobs({ jobsRoot, privateRoot, runtime, backend, rpc, E, actor, execute, url }));
    metrics.status = 'PASS'; metrics.sourceFiles = Object.fromEntries(fs.readdirSync(path.resolve(__dirname, '..')).filter(n => n.endsWith('.cjs')).map(n => [n, sha(fs.readFileSync(path.resolve(__dirname, '..', n)))]));
    writeNew(path.join(output, 'qualification.json'), metrics);
  } finally { if (runtime) await runtime.close(); if (server) await new Promise(resolve => { server.closeAllConnections(); server.close(resolve); }); await connection.close(); fs.rmSync(privateRoot, { recursive: true, force: true }); }
}
if (require.main === module) main().catch(error => { console.error('DISPOSABLE_REHEARSAL_FAILED:', error.message, error.stack?.split('\n').slice(1, 3).join('\n')); process.exitCode = 1; });
module.exports = { main };
