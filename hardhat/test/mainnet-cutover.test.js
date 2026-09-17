import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import runtime from '../scripts/runtime.cjs';
import legacy from '../qualification/legacy-snapshot.cjs';

const { ethers, network } = await runtime.getRuntime();
const { snapshotLegacy, LEGACY_ABI, WRAPPER_ABI, REGISTRY_ABI, RESOLVER_ABI, json } = legacy;
const PIN = JSON.parse(fs.readFileSync(new URL('../qualification/cutover-pin.json', import.meta.url), 'utf8'));
const rpc = (method, params = []) => network.provider.request({ method, params });
const send = async transaction => (await transaction).wait();
const rejects = transaction => assert.rejects(() => send(transaction), /revert|CALL_EXCEPTION/);
const micro = value => BigInt(value) * 1_000_000n;
const USDC_ABI = [
  'function balanceOf(address) view returns(uint256)', 'function allowance(address,address) view returns(uint256)',
  'function approve(address,uint256) returns(bool)', 'function transfer(address,uint256) returns(bool)',
  'function masterMinter() view returns(address)', 'function blacklister() view returns(address)',
  'function configureMinter(address,uint256) returns(bool)', 'function mint(address,uint256) returns(bool)',
  'function blacklist(address)', 'function unBlacklist(address)',
  'event Transfer(address indexed from,address indexed to,uint256 value)',
];

describe('USDC cutover alongside the actual legacy mainnet manager and ENS', function () {
  this.timeout(300_000);
  let deployer, owner, employer, agent, validator, wallet30, wallet10, outsider, moderator;
  let token, manager, pages, wrapper, registry, resolver, rootOwner, blacklister, managerAddress, pagesAddress;
  let baseline, snapshot, legacyChanged, rootName, rootNode, preservationFailures = 0;
  const reserveFields = ['lockedEscrow', 'lockedAgentBonds', 'lockedValidatorBonds', 'lockedDisputeBonds'];
  const reserves = () => Promise.all(reserveFields.map(field => manager[field]()));
  const recipients = () => [employer.address, agent.address, validator.address, wallet30.address, wallet10.address, managerAddress];
  const balances = () => Promise.all(recipients().map(address => token.balanceOf(address)));
  const parsed = (receipt, contract) => receipt.logs.filter(log => log.address.toLowerCase() === contract.target.toLowerCase())
    .map(log => contract.interface.parseLog(log)).filter(Boolean);

  async function localSigner(address) {
    await rpc('hardhat_impersonateAccount', [address]);
    await rpc('hardhat_setBalance', [address, ethers.toQuantity(ethers.parseEther('10'))]);
    return ethers.getSigner(address);
  }

  async function assertLegacyPreserved() {
    assert.deepEqual(await snapshotLegacy(ethers.provider, PIN.legacyManager), baseline,
      'Legacy jobs, asset balances/approvals, reserves, ownership, ENS wiring and records must remain unchanged');
  }

  async function activate() {
    await send(manager.transferOwnership(owner.address));
    await send(manager.connect(owner).acceptOwnership());
    await send(pages.transferOwnership(owner.address));
    await send(manager.connect(owner).unpauseIntake());
  }

  async function create(cost = micro(100)) {
    const id = await manager.nextJobId();
    const receipt = await send(manager.connect(employer).createJob('ipfs://cutover-spec', cost, 3600, 'USDC cutover rehearsal'));
    return { id, receipt };
  }

  async function ready(cost = micro(100), vote = true) {
    const { id, receipt } = await create(cost);
    await send(manager.connect(agent).applyForJob(id, '', []));
    await send(manager.connect(agent).requestJobCompletion(id, 'ipfs://cutover-completion'));
    if (vote) await send(manager.connect(validator).validateJob(id, '', []));
    return { id, receipt };
  }

  async function advanceReview() {
    await rpc('evm_increaseTime', [Number(await manager.completionReviewPeriod()) + Number(await manager.challengePeriodAfterApproval()) + 1]);
    await rpc('evm_mine');
  }

  before(async function () {
    assert.equal(network.name, 'hardhat', 'Never execute qualification writes on a public network');
    assert.equal(network.config.type, 'edr-simulated');
    assert.equal(network.config.chainId, 1);
    assert.equal(Number(network.config.forking.blockNumber), PIN.blockNumber);
    assert.notEqual(network.config.allowUnlimitedContractSize, true);
    assert.equal((await ethers.provider.getBlock(PIN.blockNumber)).hash, PIN.blockHash);
    const implementation = `0x${(await ethers.provider.getStorage(PIN.usdc, ethers.id('org.zeppelinos.proxy.implementation'))).slice(-40)}`;
    assert.equal(implementation.toLowerCase(), PIN.usdcImplementation.toLowerCase());
    assert.equal(ethers.keccak256(await ethers.provider.getCode(implementation)), PIN.usdcImplementationCodeHash);
    baseline = await snapshotLegacy(ethers.provider, PIN.legacyManager);
    assert.equal(baseline.runtimeCodeHash, PIN.legacyManagerCodeHash);
    assert.equal(baseline.owner, PIN.legacyOwner);
    assert.equal(baseline.ensJobPages, PIN.legacyPages);
    assert.equal(baseline.nextJobId, '12');
    assert.equal(baseline.jobs.find(job => job.id === 11).core[5], false, 'Include the actual unsettled legacy job');
    console.log(`    Legacy baseline: ${baseline.nextJobId} allocated job IDs, escrow=${baseline.lockedEscrow}, agent bonds=${baseline.lockedAgentBonds}, token decimals=${baseline.tokenDecimals}`);
    [deployer, employer, agent, validator, wallet30, wallet10, outsider, moderator] = await ethers.getSigners();
    owner = await localSigner(baseline.owner);
    assert.equal(await ethers.provider.getCode(owner.address), '0x', 'This rehearsal models the observed EOA owner; contract-owner execution needs a separate rehearsal');
    rootOwner = await localSigner(baseline.rootData[0]);
    assert.equal(rootOwner.address, PIN.legacyRootOwner);
    assert.equal(await ethers.provider.getCode(rootOwner.address), '0x', 'Do not impersonate a contract as though its owner could sign arbitrary calls');
    token = new ethers.Contract(PIN.usdc, USDC_ABI, deployer);
    const minter = await localSigner(await token.masterMinter());
    blacklister = await localSigner(await token.blacklister());
    await send(token.connect(minter).configureMinter(deployer.address, micro(10_000)));
    for (const signer of [employer, agent, validator]) await send(token.mint(signer.address, micro(2000)));
    const libraries = {};
    for (const name of ['UriUtils', 'TransferUtils', 'BondMath', 'ReputationMath', 'ENSOwnership']) {
      const instance = await (await ethers.getContractFactory(name)).deploy();
      await instance.waitForDeployment();
      libraries[name] = await instance.getAddress();
    }
    manager = await (await ethers.getContractFactory('AGIJobManager', { libraries })).deploy(PIN.usdc, 'ipfs://',
      [baseline.pages.ens, baseline.pages.nameWrapper], Array(4).fill(ethers.ZeroHash), Array(2).fill(ethers.ZeroHash), [wallet30.address, wallet10.address]);
    await manager.waitForDeployment();
    managerAddress = await manager.getAddress();
    assert(ethers.dataLength(await ethers.provider.getCode(managerAddress)) <= 24576);
    assert.equal(await manager.paused(), true);
    wrapper = new ethers.Contract(baseline.pages.nameWrapper, WRAPPER_ABI, rootOwner);
    registry = new ethers.Contract(baseline.pages.ens, REGISTRY_ABI, ethers.provider);
    resolver = new ethers.Contract(baseline.pages.publicResolver, RESOLVER_ABI, ethers.provider);
    rootName = `usdc-v091.${baseline.pages.jobsRootName}`;
    rootNode = ethers.namehash(rootName);
    assert.equal(await registry.owner(rootNode), ethers.ZeroAddress, 'The rehearsal namespace must be unused at the pinned block');
    pages = await (await ethers.getContractFactory('ENSJobPages')).deploy(baseline.pages.ens, baseline.pages.nameWrapper,
      baseline.pages.publicResolver, rootNode, rootName);
    await pages.waitForDeployment();
    pagesAddress = await pages.getAddress();
    await send(wrapper.setSubnodeOwner(baseline.pages.jobsRootNode, 'usdc-v091', pagesAddress, 0, BigInt(baseline.rootData[2])));
    await send(pages.setJobManager(managerAddress));
    await send(manager.setEnsJobPages(pagesAddress));
    const nft = await (await ethers.getContractFactory('MockERC721')).deploy();
    await nft.waitForDeployment();
    await send(nft.mint(agent.address));
    await send(manager.addAGIType(await nft.getAddress(), 1));
    await send(manager.addAdditionalAgent(agent.address));
    await send(manager.addAdditionalValidator(validator.address));
    await send(manager.addModerator(moderator.address));
    await send(manager.setRequiredValidatorApprovals(1));
    for (const signer of [employer, agent, validator]) await send(token.connect(signer).approve(managerAddress, micro(2000)));
    await assertLegacyPreserved();
    snapshot = await rpc('evm_snapshot');
  });

  beforeEach(async function () {
    assert.equal(await rpc('evm_revert', [snapshot]), true);
    snapshot = await rpc('evm_snapshot');
    legacyChanged = false;
  });

  afterEach(async function () {
    if (!legacyChanged) {
      try { await assertLegacyPreserved(); }
      catch (error) { preservationFailures += 1; throw error; }
    }
  });

  it('keeps new intake closed through a two-step manager handover and removes all deployer owner authority', async function () {
    await rejects(manager.connect(employer).createJob('ipfs://paused', micro(100), 3600, 'paused'));
    await send(manager.transferOwnership(owner.address));
    assert.equal(await manager.owner(), deployer.address);
    assert.equal(await manager.pendingOwner(), owner.address);
    await rejects(manager.connect(outsider).acceptOwnership());
    await rejects(manager.connect(owner).unpauseIntake());
    await send(manager.connect(owner).acceptOwnership());
    assert.equal(await manager.pendingOwner(), ethers.ZeroAddress);
    assert.equal(await manager.paused(), true);
    await send(pages.transferOwnership(owner.address));
    assert.equal(await pages.owner(), owner.address);
    for (const operation of [() => manager.unpauseIntake(), () => manager.setEnsJobPages(PIN.legacyPages),
      () => manager.setSettlementWallets(outsider.address, moderator.address), () => pages.setJobManager(PIN.legacyManager)]) await rejects(operation());
    await send(manager.connect(owner).unpauseIntake());
    await create();
  });

  it('creates, updates and revokes an isolated ENS job page through the real mainnet wrapper and resolver', async function () {
    await activate();
    const { id, receipt } = await create();
    const hooks = parsed(receipt, pages);
    assert(hooks.some(event => event.name === 'JobENSPageCreated'), 'CREATE hook must actually create a name');
    assert(!hooks.some(event => ['ENSHookSkipped', 'ENSHookBestEffortFailure'].includes(event.name)),
      `ENS CREATE must not silently degrade: ${hooks.map(event => `${event.name}:${event.args}`).join('; ')}`);
    const node = await pages.jobEnsNode(id);
    assert.equal(await pages.jobEnsName(id), `agijob0.${rootName}`);
    assert.equal(await registry.resolver(node), baseline.pages.publicResolver);
    assert.equal(await resolver.text(node, 'agijobs.spec.public'), 'ipfs://cutover-spec');
    assert.equal(await resolver.isApprovedFor(pagesAddress, node, employer.address), true);
    assert.equal(await resolver.isApprovedFor(pagesAddress, node, outsider.address), false);
    await rejects(resolver.connect(outsider).setText(node, 'rehearsal', 'unauthorized'));
    await send(resolver.connect(employer).setText(node, 'rehearsal', 'employer'));
    await send(manager.connect(agent).applyForJob(id, '', []));
    assert.equal(await resolver.isApprovedFor(pagesAddress, node, agent.address), true);
    await send(resolver.connect(agent).setText(node, 'rehearsal', 'agent'));
    await send(manager.connect(agent).requestJobCompletion(id, 'ipfs://cutover-completion'));
    assert.equal(await resolver.text(node, 'agijobs.completion.public'), 'ipfs://cutover-completion');
    await send(manager.connect(validator).validateJob(id, '', []));
    await advanceReview();
    const settled = parsed(await send(manager.finalizeJob(id)), pages);
    assert(!settled.some(event => ['ENSHookSkipped', 'ENSHookBestEffortFailure'].includes(event.name)), 'Terminal ENS permissions must actually be revoked');
    assert.equal(await resolver.isApprovedFor(pagesAddress, node, employer.address), false);
    assert.equal(await resolver.isApprovedFor(pagesAddress, node, agent.address), false);
    await rejects(resolver.connect(employer).setText(node, 'rehearsal', 'after settlement'));
    await rejects(resolver.connect(agent).setText(node, 'rehearsal', 'after settlement'));
  });

  it('settles native USDC exactly 8/30/10/52 with bonds separate while preserving every legacy job', async function () {
    await activate();
    const before = await balances();
    const { id } = await ready();
    await advanceReview();
    await send(manager.finalizeJob(id));
    assert.deepEqual((await balances()).map((v, i) => v - before[i]), [-micro(100), micro(52), micro(8), micro(30), micro(10), 0n]);
    assert.deepEqual(await reserves(), [0n, 0n, 0n, 0n]);
    await rejects(manager.finalizeJob(id));
  });

  it('refunds exact micro-USDC on cancellation and rejects reuse of cancelled job IDs', async function () {
    await activate();
    const before = await balances();
    const { id } = await create(1n);
    await send(manager.connect(owner).pauseIntake());
    await send(manager.connect(employer).cancelJob(id));
    assert.deepEqual(await balances(), before);
    assert.deepEqual(await reserves(), [0n, 0n, 0n, 0n]);
    await rejects(manager.connect(employer).cancelJob(id));
    await send(manager.connect(owner).unpauseIntake());
    assert.equal((await create(1n)).id, id + 1n);
  });

  it('conserves USDC with three validators, indivisible rewards and the default three-approval threshold', async function () {
    for (const signer of [outsider, moderator]) {
      await send(token.mint(signer.address, micro(100)));
      await send(token.connect(signer).approve(managerAddress, micro(100)));
      await send(manager.addAdditionalValidator(signer.address));
    }
    await send(manager.setRequiredValidatorApprovals(3));
    await activate();
    const tracked = [validator, outsider, moderator, wallet30, wallet10, agent].map(signer => signer.address);
    const before = await Promise.all(tracked.map(address => token.balanceOf(address)));
    const { id } = await ready(100_000_001n);
    await send(manager.connect(outsider).validateJob(id, '', []));
    await send(manager.connect(moderator).validateJob(id, '', []));
    await advanceReview();
    await send(manager.finalizeJob(id));
    const after = await Promise.all(tracked.map(address => token.balanceOf(address)));
    assert.deepEqual(after.map((v, i) => v - before[i]), [2_666_666n, 2_666_666n, 2_666_666n, 30_000_000n, 10_000_000n, 52_000_003n]);
    assert.equal(after.reduce((sum, v, i) => sum + v - before[i], 0n), 100_000_001n);
    assert.deepEqual(await reserves(), [0n, 0n, 0n, 0n]);
  });

  it('preserves posting-time validator rewards when the owner changes the rate for future jobs', async function () {
    await activate();
    const { id } = await create();
    await send(manager.connect(owner).setValidationRewardPercentage(60));
    const before = await balances();
    await send(manager.connect(agent).applyForJob(id, '', []));
    await send(manager.connect(agent).requestJobCompletion(id, 'ipfs://completed'));
    await send(manager.connect(validator).validateJob(id, '', []));
    await advanceReview();
    await send(manager.finalizeJob(id));
    assert.deepEqual((await balances()).map((v, i) => v - before[i]), [0n, micro(52), micro(8), micro(30), micro(10), -micro(100)]);
  });

  it('conserves one-micro-USDC rounding and sends the full remainder to the agent without validator votes', async function () {
    await activate();
    const before = await balances();
    const { id } = await ready(1n, false);
    await advanceReview();
    await send(manager.finalizeJob(id));
    assert.deepEqual((await balances()).map((v, i) => v - before[i]), [-1n, 1n, 0n, 0n, 0n, 0n]);
    assert.deepEqual(await reserves(), [0n, 0n, 0n, 0n]);
  });

  for (const resolution of [1, 2]) {
    it(`atomically recovers all four reserve classes from a blocked disputed ${resolution === 1 ? 'agent payout' : 'employer refund'}`, async function () {
      await activate();
      const { id } = await ready();
      await send(manager.connect(employer).disputeJob(id));
      const beforeBalances = await balances(), beforeReserves = await reserves();
      assert(beforeReserves.every(value => value > 0n));
      const blocked = resolution === 1 ? agent.address : employer.address;
      await send(token.connect(blacklister).blacklist(blocked));
      await rejects(manager.connect(moderator).resolveDisputeWithCode(id, resolution, 'rehearsal'));
      assert.deepEqual(await balances(), beforeBalances);
      assert.deepEqual(await reserves(), beforeReserves);
      assert.equal((await manager.getJobCore(id)).completed, false);
      await send(token.connect(blacklister).unBlacklist(blocked));
      await send(manager.connect(moderator).resolveDisputeWithCode(id, resolution, 'rehearsal'));
      assert.deepEqual(await reserves(), [0n, 0n, 0n, 0n]);
      assert.equal(await token.balanceOf(managerAddress), 0n);
      await rejects(manager.connect(moderator).resolveDisputeWithCode(id, resolution, 'duplicate'));
    });
  }

  it('isolates concurrent jobs and permits recipient rotation only after paused intake and complete settlement', async function () {
    await activate();
    const first = await ready(), second = await ready();
    await send(manager.connect(owner).pauseIntake());
    await rejects(manager.connect(owner).setSettlementWallets(outsider.address, moderator.address));
    await rejects(manager.connect(owner).withdrawUSDC(1n));
    await advanceReview();
    await send(manager.finalizeJob(first.id));
    assert.equal(await manager.lockedEscrow(), micro(100));
    assert.equal((await manager.getJobCore(second.id)).completed, false);
    await rejects(manager.connect(owner).setSettlementWallets(outsider.address, moderator.address));
    await send(manager.finalizeJob(second.id));
    await send(manager.connect(owner).setSettlementWallets(outsider.address, moderator.address));
    assert.equal(await manager.wallet30(), outsider.address);
    assert.equal(await manager.wallet10(), moderator.address);
  });

  it('recovers from an emergency pause without stranding the new escrow or changing legacy pause state', async function () {
    await activate();
    const { id } = await ready();
    await advanceReview();
    const before = await reserves();
    await send(manager.connect(owner).pauseAll());
    await rejects(manager.finalizeJob(id));
    assert.deepEqual(await reserves(), before);
    await send(manager.connect(owner).setSettlementPaused(false));
    assert.equal(await manager.paused(), true);
    await send(manager.finalizeJob(id));
    assert.deepEqual(await reserves(), [0n, 0n, 0n, 0n]);
  });

  it('lets the actual unsettled legacy job exit on its original contract and original asset after the new launch', async function () {
    await activate();
    await create();
    const before = { balances: await balances(), reserves: await reserves(), core: Array.from(await manager.getJobCore(0)) };
    const old = new ethers.Contract(PIN.legacyManager, LEGACY_ABI, outsider);
    const oldToken = new ethers.Contract(baseline.agiToken, ['function balanceOf(address) view returns(uint256)'], ethers.provider);
    const oldJob = await old.getJobCore(11), oldBalance = await oldToken.balanceOf(oldJob.employer);
    await send(old.expireJob(11));
    legacyChanged = true;
    assert.equal((await old.getJobCore(11)).expired, true);
    assert.equal(await old.lockedEscrow(), 0n);
    assert.equal(oldJob.employer, oldJob.assignedAgent, 'The recorded job has the same employer and agent');
    assert.equal(await oldToken.balanceOf(oldJob.employer) - oldBalance, oldJob.payout + BigInt(baseline.lockedAgentBonds));
    assert.equal(await old.lockedAgentBonds(), 0n);
    assert.deepEqual(await balances(), before.balances);
    assert.deepEqual(await reserves(), before.reserves);
    assert.deepEqual(Array.from(await manager.getJobCore(0)), before.core);
  });

  after(function () {
    const tests = this.test.parent.tests;
    if (preservationFailures || tests.some(test => test.state !== 'passed')) return;
    const root = path.resolve(new URL('../..', import.meta.url).pathname);
    const sources = ['package-lock.json', 'hardhat/package-lock.json', 'hardhat/hardhat.config.js', 'hardhat.cutover-fork.config.mjs',
      'hardhat/test/mainnet-cutover.test.js', 'hardhat/qualification/legacy-snapshot.cjs', 'hardhat/qualification/cutover-pin.json',
      'hardhat/scripts/runtime.cjs', 'scripts/security/patch-openzeppelin-compiler.cjs', 'scripts/security/openzeppelin-compiler-patches.json'];
    function collect(directory) {
      for (const entry of fs.readdirSync(path.join(root, directory), { withFileTypes: true })) {
        const filename = `${directory}/${entry.name}`;
        if (entry.isDirectory()) collect(filename);
        else if (entry.name.endsWith('.sol')) sources.push(filename);
      }
    }
    collect('contracts');
    const sourceSha256 = Object.fromEntries(sources.sort().map(filename => [filename, createHash('sha256').update(fs.readFileSync(path.join(root, filename))).digest('hex')]));
    const report = { scope: 'isolated local Ethereum fork; no public transactions or live signer-control proof', sourceSha256,
      pin: PIN, legacyBaseline: baseline, newEnsRoot: rootName, assertions: tests.map(test => test.title),
      passed: tests.length, publicTransactionsBroadcast: 0, fixtureWallets: true, productionActivationApproved: false };
    const output = process.env.CUTOVER_REPORT || path.resolve('artifacts/cutover-qualification.json');
    fs.mkdirSync(path.dirname(output), { recursive: true });
    fs.writeFileSync(output, `${JSON.stringify(json(report), null, 2)}\n`);
    console.log(`    Qualification evidence: ${output}`);
  });
});
