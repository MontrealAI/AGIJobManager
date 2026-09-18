import assert from 'node:assert/strict';
import runtime from '../scripts/runtime.cjs';
const { ethers, artifacts, network } = await runtime.getRuntime();
import deployment from '../scripts/deploy.cjs';
const { FQNS, LIBRARIES, qualifiedBuild } = deployment;
import safety from '../scripts/deployment-safety.cjs';
const { requireArtifactMatch, requireConfirmedReceipt, prepareDeployment } = safety;

describe('Release deployment under Ethereum code-size limits', function () {
  this.timeout(120000);
  let owner, successor, employer, wallet30, wallet10, token, libraries, buildInfo, manager;

  async function deployWithinLimits(name, args = [], options = {}) {
    const factory = await ethers.getContractFactory(name, options);
    const expected = await factory.getDeployTransaction(...args);
    assert(ethers.dataLength(expected.data) <= 49152, `${name} full initcode exceeds EIP-3860`);
    const prepared = await prepareDeployment({ provider: ethers.provider, factory, args, from: owner.address, name });
    const contract = await factory.deploy(...args, { gasLimit: prepared.gasLimit });
    const transaction = contract.deploymentTransaction();
    const receipt = requireConfirmedReceipt(await transaction.wait(), transaction.hash, await contract.getAddress());
    assert.equal(transaction.data, expected.data, `${name} constructor calldata must be measured exactly`);
    assert(transaction.gasLimit <= 16777216n, `${name} requested gas exceeds EIP-7825`);
    assert(receipt.gasUsed <= transaction.gasLimit);
    assert(receipt.gasUsed <= 16777216n);
    const code = await ethers.provider.getCode(await contract.getAddress());
    assert(ethers.dataLength(code) > 0 && ethers.dataLength(code) <= 24576, `${name} runtime exceeds EIP-170`);
    console.log(`    ${name}: runtime=${ethers.dataLength(code)}, initcode=${ethers.dataLength(expected.data)}, gasUsed=${receipt.gasUsed}, gasLimit=${transaction.gasLimit}`);
    return contract;
  }

  before(async function () {
    assert.notEqual(network.config.allowUnlimitedContractSize, true, 'EIP-170 enforcement must remain enabled');
    [owner, successor, employer, wallet30, wallet10] = await ethers.getSigners();
    ({ buildInfo } = await qualifiedBuild());
    token = await (await ethers.getContractFactory('MockERC20')).deploy();
    await token.waitForDeployment();
    libraries = {};
    for (const name of LIBRARIES) {
      const library = await deployWithinLimits(name, [], { libraries });
      const address = await library.getAddress();
      libraries[FQNS[name]] = address;
      requireArtifactMatch({ artifact: await artifacts.readArtifact(FQNS[name]), buildInfo, address, libraries, code: await ethers.provider.getCode(address) });
    }
  });

  beforeEach(async function () {
    const args = [await token.getAddress(), 'ipfs://', [ethers.ZeroAddress, ethers.ZeroAddress],
      Array(4).fill(ethers.ZeroHash), Array(2).fill(ethers.ZeroHash), [wallet30.address, wallet10.address]];
    manager = await deployWithinLimits('AGIJobManager', args, { libraries });
  });

  it('deploys the fully linked release and matches runtime, immutable token and every library', async function () {
    const address = await manager.getAddress();
    const transaction = manager.deploymentTransaction();
    requireConfirmedReceipt(await transaction.wait(), transaction.hash, address);
    const code = await ethers.provider.getCode(address);
    const runtimeBytes = requireArtifactMatch({ artifact: await artifacts.readArtifact(FQNS.AGIJobManager), buildInfo,
      address, libraries, tokenAddress: await token.getAddress(), code });
    assert.ok(runtimeBytes <= 24576);
    assert.equal(await manager.usdcToken(), await token.getAddress());
    assert.equal(await manager.wallet30(), wallet30.address);
    assert.equal(await manager.wallet10(), wallet10.address);
    assert.equal(await manager.paused(), true);
    assert.equal(await manager.agentNftRequired(), true);
    assert.equal(await manager.settlementPaused(), false);
  });

  it('keeps admission closed across deployment and two-step handoff until the accepted owner activates', async function () {
    const managerAddress = await manager.getAddress();
    await (await token.mint(employer.address, 100000000n)).wait();
    await (await token.connect(employer).approve(managerAddress, 100000000n)).wait();
    await assert.rejects(manager.connect(employer).createJob('ipfs://release-test', 100000000n, 3600, 'test'), /revert/);
    assert.equal(await token.balanceOf(managerAddress), 0n);
    await (await manager.transferOwnership(successor.address)).wait();
    assert.equal(await manager.owner(), owner.address);
    assert.equal(await manager.pendingOwner(), successor.address);
    await assert.rejects(manager.connect(employer).acceptOwnership(), /revert/);
    await (await manager.connect(successor).acceptOwnership()).wait();
    assert.equal(await manager.paused(), true);
    await assert.rejects(manager.unpauseIntake(), /revert/);
    await (await manager.connect(successor).unpauseIntake()).wait();
    await (await manager.connect(employer).createJob('ipfs://release-test', 100000000n, 3600, 'test')).wait();
    assert.equal(await manager.lockedEscrow(), 100000000n);
    assert.equal(await token.balanceOf(managerAddress), 100000000n);
  });

  it('fails artifact verification for a substituted immutable token or linked payout library', async function () {
    const address = await manager.getAddress();
    const args = { artifact: await artifacts.readArtifact(FQNS.AGIJobManager), buildInfo, address, libraries,
      tokenAddress: await token.getAddress(), code: await ethers.provider.getCode(address) };
    assert.throws(() => requireArtifactMatch({ ...args, tokenAddress: employer.address }), /differs/);
    assert.throws(() => requireArtifactMatch({ ...args, libraries: { ...libraries, [FQNS.TransferUtils]: employer.address } }), /differs/);
  });

  it('rejects a substituted self-address in the via-IR transfer library', async function () {
    const address = libraries[FQNS.TransferUtils];
    const artifact = await artifacts.readArtifact(FQNS.TransferUtils);
    const code = await ethers.provider.getCode(address);
    assert.throws(() => requireArtifactMatch({ artifact, buildInfo, address: employer.address, code }), /runtime differs/);
  });

  it('deploys with the maximum permitted manager metadata within mainnet transaction limits', async function () {
    const gateway = `https://example.org/ipfs/${'a'.repeat(487)}`;
    assert.equal(ethers.toUtf8Bytes(gateway).length, 512);
    const instance = await deployWithinLimits('AGIJobManager', [await token.getAddress(), gateway,
      [ethers.ZeroAddress, ethers.ZeroAddress], Array(4).fill(ethers.ZeroHash), Array(2).fill(ethers.ZeroHash),
      [wallet30.address, wallet10.address]], { libraries });
    assert.equal(await instance.paused(), true);
  });

  it('deploys and wires optional ENS pages with bounded constructor data, runtime and transaction gas', async function () {
    const registry = await (await ethers.getContractFactory('MockENSRegistry')).deploy();
    const wrapper = await (await ethers.getContractFactory('MockNameWrapper')).deploy();
    const resolver = await (await ethers.getContractFactory('MockPublicResolver')).deploy();
    await Promise.all([registry.waitForDeployment(), wrapper.waitForDeployment(), resolver.waitForDeployment()]);
    const rootName = ['a'.repeat(63), 'b'.repeat(63), 'c'.repeat(63), 'd'.repeat(44), 'eth'].join('.');
    assert.equal(ethers.toUtf8Bytes(rootName).length, 240);
    const rootNode = ethers.namehash(rootName);
    const pages = await deployWithinLimits('ENSJobPages', [await registry.getAddress(), await wrapper.getAddress(),
      await resolver.getAddress(), rootNode, rootName]);
    await (await pages.setJobManager(await manager.getAddress())).wait();
    await (await manager.setEnsJobPages(await pages.getAddress())).wait();
    assert.equal(await pages.jobsRootName(), rootName);
    assert.equal(await pages.jobsRootNode(), rootNode);
    assert.equal(await pages.jobManager(), await manager.getAddress());
    assert.equal(await manager.ensJobPages(), await pages.getAddress());
    assert.equal(await pages.owner(), owner.address);
  });

  it('deploys and wires the optional metadata router with actual URI constructor strings', async function () {
    const base = 'https://metadata.example.org/jobs/';
    const external = 'https://jobs.example.org/';
    const pages = await deployWithinLimits('AGIJobPages', [base, external]);
    await (await pages.setJobManager(await manager.getAddress())).wait();
    await (await manager.setEnsJobPages(await pages.getAddress())).wait();
    await (await manager.setUseEnsJobTokenURI(true)).wait();
    assert.equal(await pages.previewTokenURI(42), `${base}42.json`);
    assert.equal(await pages.externalUrlBase(), external);
    assert.equal(await pages.jobManager(), await manager.getAddress());
    assert.equal(await manager.ensJobPages(), await pages.getAddress());
  });

  it('rejects excessive router constructor strings before estimating or broadcasting', async function () {
    const factory = await ethers.getContractFactory('AGIJobPages');
    const nonce = await ethers.provider.getTransactionCount(owner.address);
    await assert.rejects(prepareDeployment({ provider: ethers.provider, factory,
      args: ['x'.repeat(49152), 'https://jobs.example.org/'], from: owner.address, name: 'AGIJobPages' }), /EIP-3860/);
    assert.equal(await ethers.provider.getTransactionCount(owner.address), nonce);
  });

  it('enforces the EIP-7825 requested gas cap on the actual test provider', async function () {
    const tx = await owner.sendTransaction({ to: employer.address, value: 0n, gasLimit: 16777216n });
    assert.equal((await tx.wait()).status, 1);
    await assert.rejects(owner.sendTransaction({ to: employer.address, value: 0n, gasLimit: 16777217n }), /gas.*limit|16777216|cap/i);
  });

  it('rejects initcode exceeding EIP-3860 on the actual test provider', async function () {
    await assert.rejects(owner.sendTransaction({ data: `0x${'00'.repeat(49153)}` }), /initcode|max init code|49152/i);
  });
});
