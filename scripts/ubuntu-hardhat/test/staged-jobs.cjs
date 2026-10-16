'use strict';
// Test-only adaptation of the exact native staged writer to our owned EDR.
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto'), assert = require('node:assert/strict'), { createRequire } = require('node:module');
const { GOVERNOR, sha, writeNew, sourceGuard } = require('../safety.cjs');
async function rehearseJobs({ jobsRoot, privateRoot, runtime, backend, rpc, E, actor, execute, url }) {
  const jr = createRequire(path.join(jobsRoot, 'package.json')), oldCwd = process.cwd(), oldEnv = { ...process.env };
  const ensFile = path.join(jobsRoot, 'config/ens.json'), originalEns = fs.readFileSync(ensFile), originalMode = fs.statSync(ensFile).mode & 0o777;
  let originalConsole = console.log;
  try {
    process.chdir(jobsRoot); process.env.HARDHAT_NETWORK = 'hardhat';
    const h2 = jr('hardhat');
    // No source edits: the native writer's HRE uses only this disposable backend.
    const request = args => rpc(args.method, args.params || []);
    h2.network.name = 'localhost'; h2.network.config = { chainId: 1, accounts: [] };
    h2.network.provider = { request, send: (method, params) => rpc(method, params), on() {}, removeListener() {} };
    h2.ethers.provider = runtime.provider;
    jr('ts-node').register({ transpileOnly: true, compilerOptions: { module: 'commonjs', moduleResolution: 'node' } });
    const configApi = jr('./scripts/config/index.js');
    const normalized = configApi.loadEnsConfig({ network: 'localhost', persist: false });
    const normalizedBytes = Buffer.from(JSON.stringify(normalized.config, null, 2) + '\n');
    assert.equal(sha(normalizedBytes), '395ea0a49d70f8e6777c0d611c40546cc7dc24ab1b71eeafbb765099fed8eb61');
    fs.writeFileSync(ensFile, normalizedBytes); fs.chmodSync(ensFile, originalMode);
    sourceGuard(jobsRoot, 'jobs');
    const actorData = await actor(), token = configApi.loadTokenConfig({ network: 'localhost' }).config;
    const tokenArtifact = JSON.parse(fs.readFileSync(path.join(jobsRoot, 'artifacts/contracts/v2/mocks/LocalAgialpha.sol/LocalAgialpha.json')));
    await backend('hardhat_setCode', [token.address, tokenArtifact.deployedBytecode]); await backend('hardhat_mine', ['0x1']);
    const initial = await runtime.provider.getBlock('latest');
    const config = JSON.parse(fs.readFileSync(path.join(jobsRoot, 'demo/aurora/config/deployer.hardhat.json')));
    config.governance = GOVERNOR; config.chainId = 1; config.campaign = { chainId: 1, blockNumber: initial.number, blockHash: initial.hash };
    config.authority = { stakeManagerTreasury: GOVERNOR, feePoolTreasury: GOVERNOR, feePoolGovernance: GOVERNOR };
    config.identity.clubRootNode = normalized.config.roots.club.node; config.identity.agentRootNode = normalized.config.roots.agent.node;
    const configFile = path.join(privateRoot, 'jobs-config.json'); writeNew(configFile, config);
    const profileApi = jr('./scripts/deploy/external-profile.cjs');
    const manifest = { schema: 'jobs-reviewed-source-v1', sourceCommit: '9a79f38ad9edc448dc0b8d8cfa6157ee0c6f2bc5', sourceTree: '720312acac83eddeeb76644e1e22f53578e91784', files: profileApi.requiredSourceFiles(jobsRoot).map(name => { const file = path.join(jobsRoot, name); return { path: name, sha256: sha(fs.readFileSync(file)), mode: fs.statSync(file).mode & 0o100 ? '100755' : '100644' }; }) };
    const manifestFile = path.join(privateRoot, 'jobs-manifest.json'); writeNew(manifestFile, manifest);
    const readSource = jr('./scripts/deploy/authority-runtime.cjs').createAuthoritySourceReader(jobsRoot);
    const compiler = readSource('Deployer', E.ZeroAddress, { token: token.address });
    const scope = { chainId: 1, creator: actorData.address, governance: GOVERNOR, campaign: config.campaign, initialBlock: { number: initial.number, hash: initial.hash, timestamp: initial.timestamp } };
    const nativeSession = jr('./scripts/deploy/external-session.cjs'), locks = path.join(privateRoot, 'jobs-locks'); fs.mkdirSync(locks);
    const plan = { schema: 'jobs-external-plan-v1', campaignId: crypto.randomUUID(), chainId: 1, creator: actorData.address, governor: GOVERNOR, sourceCommit: manifest.sourceCommit, sourceTree: manifest.sourceTree, compilerInputSha256: compiler.compilerInputSha256, sourceManifestHash: sha(fs.readFileSync(manifestFile)), configHash: '0x' + sha(fs.readFileSync(configFile)), creationScopeHash: nativeSession.digest(scope), firstNonce: 0, creatorCodeHash: E.keccak256('0x'), initialBlock: { number: initial.number, hash: initial.hash }, confirmations: 1, expiresAt: new Date(Date.now() + 6 * 60 * 60000).toISOString(), fees: { gasLimit: '16777216', maxFeePerGas: '10000000000', maxPriorityFeePerGas: '1000000000' }, lockDirectory: locks };
    const planFile = path.join(privateRoot, 'jobs-plan.json'), profileFile = path.join(privateRoot, 'jobs-profile.json'); writeNew(planFile, plan);
    writeNew(profileFile, { profile: 'jobs-external-manual-v1', sessionDirectory: path.join(privateRoot, 'jobs-session'), planFile, reviewedPlanHash: nativeSession.digest(plan), sourceManifestFile: manifestFile, reviewedSourceManifestSha256: plan.sourceManifestHash });
    Object.assign(process.env, { DEPLOY_DEFAULTS_CONFIG: configFile, DEPLOYMENT_EXTERNAL_PROFILE: profileFile, DEPLOYMENT_LOCK_DIRECTORY: locks });
    delete process.env.DEPLOYER_ADDRESS; delete process.env.DEPLOY_DEFAULTS_RESUME_EVIDENCE;
    const writer = jr('./scripts/v2/deployDefaults.ts').main;
    let prior, report;
    async function stage(i) {
      const output = path.join(privateRoot, `jobs-writer-${i}.json`); process.env.DEPLOY_DEFAULTS_OUTPUT = output;
      if (prior) { process.env.DEPLOY_DEFAULTS_RESUME_EVIDENCE = prior; process.env.DEPLOYER_ADDRESS = report.coordinator || report.authorityOperations['create:Deployer'].address; }
      console.log = () => {}; try { await writer([]); } finally { console.log = originalConsole; }
      report = JSON.parse(fs.readFileSync(output)); const old = prior; prior = output;
      if (old) fs.rmSync(old); fs.rmSync(output + '.journal.jsonl', { force: true });
      assert.equal(report.status, i === 39 ? 'awaiting-commissioning' : 'awaiting-external-manual-signature');
    }
    const hashes = await execute({ project: 'jobs', checkout: jobsRoot, profilePath: profileFile, profileSha256: sha(fs.readFileSync(profileFile)), deploymentConfigPath: configFile }, 39, actorData, undefined, stage);
    await stage(39);
    const cert = report.authorityCertificate; assert.equal(cert.boundedChecksComplete, true); assert.equal(cert.authorityComplete, false);
    for (const op of Object.values(report.authorityOperations)) assert.equal(op.creator, actorData.address);
    console.log('Disposable Jobs: 39 exact terminal-signed operations; 25 creations, native paused closeout and bounded authority checks passed.');
    return { project: 'jobs', source: manifest.sourceCommit, operations: hashes.length, creations: 25, governor: GOVERNOR, nativeCloseout: report.status, boundedAuthorityChecksComplete: cert.boundedChecksComplete, authorityComplete: false, explorerAccepted: false, qualificationLimit: 'Native complete-history and indirect/external authority acceptance remain separate', normalizedEnsSha256: sha(normalizedBytes), stagedWriterExecution: 'Original TypeScript entrypoint in process; HRE test backend replaced; not a fresh-CLI qualification claim' };
  } finally {
    console.log = originalConsole; fs.writeFileSync(ensFile, originalEns); fs.chmodSync(ensFile, originalMode);
    process.chdir(oldCwd); for (const key of Object.keys(process.env)) if (!(key in oldEnv)) delete process.env[key]; Object.assign(process.env, oldEnv);
  }
}
module.exports = { rehearseJobs };
