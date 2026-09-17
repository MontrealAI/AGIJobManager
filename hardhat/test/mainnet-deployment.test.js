const assert = require('node:assert/strict');
const { ethers, artifacts, network } = require('hardhat');
const { FQNS, LIBRARIES, qualifiedBuild } = require('../scripts/deploy');
const { requireArtifactMatch } = require('../scripts/deployment-safety');

describe('Release deployment under Ethereum code-size limits', function () {
  this.timeout(120000);
  let owner, successor, employer, wallet30, wallet10, token, libraries, buildInfo, manager;

  before(async function () {
    assert.notEqual(network.config.allowUnlimitedContractSize, true, 'EIP-170 enforcement must remain enabled');
    [owner, successor, employer, wallet30, wallet10] = await ethers.getSigners();
    ({ buildInfo } = await qualifiedBuild());
    token = await (await ethers.getContractFactory('MockERC20')).deploy();
    await token.waitForDeployment();
    libraries = {};
    for (const name of LIBRARIES) {
      const library = await (await ethers.getContractFactory(name)).deploy();
      await library.waitForDeployment();
      const address = await library.getAddress();
      libraries[FQNS[name]] = address;
      requireArtifactMatch({ artifact: await artifacts.readArtifact(FQNS[name]), buildInfo, address, code: await ethers.provider.getCode(address) });
    }
  });

  beforeEach(async function () {
    const factory = await ethers.getContractFactory('AGIJobManager', { libraries });
    const args = [await token.getAddress(), 'ipfs://', [ethers.ZeroAddress, ethers.ZeroAddress],
      Array(4).fill(ethers.ZeroHash), Array(2).fill(ethers.ZeroHash), [wallet30.address, wallet10.address]];
    const transaction = await factory.getDeployTransaction(...args);
    assert.ok(ethers.dataLength(transaction.data) <= 49152, 'EIP-3860 initcode size limit');
    manager = await factory.deploy(...args);
    await manager.waitForDeployment();
  });

  it('deploys the fully linked release and matches runtime, immutable token and every library', async function () {
    const address = await manager.getAddress();
    const code = await ethers.provider.getCode(address);
    const runtimeBytes = requireArtifactMatch({ artifact: await artifacts.readArtifact(FQNS.AGIJobManager), buildInfo,
      address, libraries, tokenAddress: await token.getAddress(), code });
    assert.ok(runtimeBytes <= 24576);
    assert.equal(await manager.usdcToken(), await token.getAddress());
    assert.equal(await manager.wallet30(), wallet30.address);
    assert.equal(await manager.wallet10(), wallet10.address);
    assert.equal(await manager.paused(), true);
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

  it('rejects initcode exceeding EIP-3860 on the actual test provider', async function () {
    await assert.rejects(owner.sendTransaction({ data: `0x${'00'.repeat(49153)}` }), /initcode|max init code|49152/i);
  });
});
