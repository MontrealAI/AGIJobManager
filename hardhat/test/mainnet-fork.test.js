import assert from 'node:assert/strict';
import runtime from '../scripts/runtime.cjs';
const { ethers, network } = await runtime.getRuntime();
const rpc = (method, params = []) => network.provider.request({ method, params });

// All mutations below are sent to Hardhat's in-process fork, never to Ethereum.
// These values identify the finalized state observed for the v0.8.0 qualification.
const PIN = {
  blockNumber: 25997388,
  blockHash: '0x1495b5decf70b7757b60b8d4ba10d14a7cdb4512f55c4ae5400d8a97b9deedf9',
  usdc: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
  implementation: '0x43506849d7c04f9138d1a2050bbf3a0c054402dd',
  implementationCodeHash: '0xcdfb7d322961af3acae7a8f7ee8b69c205b36f576cc5b077f170c7eb8ecbe3ea',
  masterMinter: '0xe982615d461dd5cd06575bbea87624fda4e3de17',
  pauser: '0x4914f61d25e5c567143774b76edbf4d5109a8566',
  blacklister: '0x0a06be16275b95a7d2567fbdae118b36c7da78f9',
};
const ABI = [
  'function decimals() view returns (uint8)', 'function symbol() view returns (string)',
  'function balanceOf(address) view returns (uint256)', 'function allowance(address,address) view returns (uint256)',
  'function approve(address,uint256) returns (bool)', 'function transfer(address,uint256) returns (bool)',
  'function masterMinter() view returns (address)', 'function pauser() view returns (address)',
  'function blacklister() view returns (address)', 'function paused() view returns (bool)',
  'function configureMinter(address,uint256) returns (bool)', 'function mint(address,uint256) returns (bool)',
  'function pause()', 'function unpause()', 'function blacklist(address)', 'function unBlacklist(address)',
  'function isBlacklisted(address) view returns (bool)',
  'event Transfer(address indexed from,address indexed to,uint256 value)',
];
const send = async promise => (await promise).wait();
const micro = value => BigInt(value) * 1_000_000n;
const rejectTransaction = promise => assert.rejects(() => send(promise), /revert|CALL_EXCEPTION/);

describe('Pinned Ethereum mainnet fork: native Circle USDC', function () {
  this.timeout(300_000);
  let owner, employer, agent, validator, wallet30, wallet10, token, manager, snapshot;
  let pauser, blacklister, managerAddress, baseline;
  const recipients = () => [validator.address, wallet30.address, wallet10.address, agent.address];
  const balances = () => Promise.all(recipients().map(address => token.balanceOf(address)));
  const reserves = () => Promise.all(['lockedEscrow', 'lockedAgentBonds', 'lockedValidatorBonds', 'lockedDisputeBonds'].map(name => manager[name]()));

  async function localSigner(address) {
    await rpc('hardhat_impersonateAccount', [address]);
    await rpc('hardhat_setBalance', [address, ethers.toQuantity(ethers.parseEther('10'))]);
    return ethers.getSigner(address);
  }

  before(async function () {
    assert.equal(network.name, 'hardhat', 'This test may run only on the in-process Hardhat network');
    assert.equal(network.config.chainId, 1, 'Use an isolated Hardhat fork configuration with chainId 1');
    assert.notEqual(network.config.allowUnlimitedContractSize, true, 'EIP-170 contract-size enforcement must remain enabled');
    assert.equal(Number(network.config.forking?.blockNumber), PIN.blockNumber, 'Use the pinned read-only fork configuration');
    assert.equal((await ethers.provider.getNetwork()).chainId, 1n);
    const block = await ethers.provider.getBlock(PIN.blockNumber);
    assert.equal(block.hash, PIN.blockHash, 'RPC returned the wrong pinned Ethereum block');
    const slot = ethers.id('org.zeppelinos.proxy.implementation');
    const implementation = `0x${(await ethers.provider.getStorage(PIN.usdc, slot)).slice(-40)}`;
    assert.equal(implementation, PIN.implementation, 'USDC implementation differs from the qualified state');
    const implementationCode = await ethers.provider.getCode(implementation);
    assert.notEqual(implementationCode, '0x');
    assert.equal(ethers.keccak256(implementationCode), PIN.implementationCodeHash);
    [owner, employer, agent, validator, wallet30, wallet10] = await ethers.getSigners();
    token = new ethers.Contract(PIN.usdc, ABI, owner);
    assert.equal(await token.decimals(), 6n);
    assert.equal(await token.symbol(), 'USDC');
    assert.equal(await token.paused(), false);
    for (const name of ['masterMinter', 'pauser', 'blacklister']) {
      assert.equal((await token[name]()).toLowerCase(), PIN[name]);
    }
    console.log(`    Qualified state: ${JSON.stringify({ ...PIN, implementationCodeHash: ethers.keccak256(implementationCode) })}`);
    const minter = await localSigner(PIN.masterMinter);
    pauser = await localSigner(PIN.pauser);
    blacklister = await localSigner(PIN.blacklister);
    // Configure a fixture minter through the real USDC authorization path on the local fork.
    await send(token.connect(minter).configureMinter(owner.address, micro(1200)));
    for (const [signer, amount] of [[employer, 1000], [agent, 100], [validator, 100]]) {
      await send(token.mint(signer.address, micro(amount)));
    }
    const libraries = {};
    for (const name of ['UriUtils', 'TransferUtils', 'BondMath', 'ReputationMath', 'ENSOwnership', 'NftEligibility', 'JobSettlement', 'JobValidation']) {
      const library = await (await ethers.getContractFactory(name, { libraries })).deploy();
      await library.waitForDeployment();
      libraries[name] = await library.getAddress();
    }
    manager = await (await ethers.getContractFactory('AGIJobManager', { libraries })).deploy(
      PIN.usdc, 'ipfs://', [ethers.ZeroAddress, ethers.ZeroAddress],
      Array(4).fill(ethers.ZeroHash), Array(2).fill(ethers.ZeroHash), [wallet30.address, wallet10.address],
    );
    await manager.waitForDeployment();
    managerAddress = await manager.getAddress();
    const runtimeSize = (await ethers.provider.getCode(managerAddress)).slice(2).length / 2;
    assert(runtimeSize <= 24_576, `Runtime is ${runtimeSize} bytes; EIP-170 limit is 24576`);
    assert.equal(await manager.paused(), true, 'Deployment must begin with intake paused');
    assert.equal(await manager.usdcToken(), PIN.usdc);
    assert.equal(await manager.validationRewardPercentage(), 8n);
    for (const signer of [employer, agent, validator]) await send(token.connect(signer).approve(managerAddress, micro(1000)));
    await rejectTransaction(manager.connect(employer).createJob('ipfs://fork', micro(100), 3600, 'paused'));
    const nft = await (await ethers.getContractFactory('MockERC721')).deploy();
    await nft.waitForDeployment();
    await send(nft.mint(agent.address));
    await send(manager.addAGIType(await nft.getAddress(), 1));
    await send(manager.setAgentNftRequired(true)); // Explicitly qualify owner-enabled admission too.
    await send(manager.addAdditionalAgent(agent.address));
    await send(manager.addAdditionalValidator(validator.address));
    await send(manager.setRequiredValidatorApprovals(1));
    await send(manager.setVoteQuorum(1));
    await send(manager.unpause());
    baseline = await balances();
    console.log(`    Mainnet-sized deployment: ${runtimeSize} runtime bytes; intake paused until owner activation`);
    snapshot = await rpc('evm_snapshot');
  });

  beforeEach(async function () {
    assert.equal(await rpc('evm_revert', [snapshot]), true);
    snapshot = await rpc('evm_snapshot');
  });

  async function ready() {
    await send(manager.connect(employer).createJob('ipfs://fork', micro(100), 3600, '100 USDC native settlement'));
    await send(manager.connect(agent).applyForJob(0, '', []));
    await send(manager.connect(agent).requestJobCompletion(0, 'ipfs://completed'));
    await send(manager.connect(validator).validateJob(0, '', []));
    const { settlementAfter } = await manager.getJobDeadlines(0);
    await rpc('evm_setNextBlockTimestamp', [Number(settlementAfter) + 1]);
    await rpc('evm_mine');
  }

  async function assertSettled() {
    assert.deepEqual((await balances()).map((balance, i) => balance - baseline[i]), [micro(8), micro(30), micro(10), micro(52)]);
    assert.deepEqual(await reserves(), [0n, 0n, 0n, 0n]);
    assert.equal(await token.balanceOf(managerAddress), 0n);
    assert.equal(await manager.lockedClaims(), 0n);
    assert.equal(await manager.withdrawableUSDC(), 0n);
    assert.equal((await manager.getJobCore(0)).completed, true);
  }

  it('settles exactly 100 USDC as 8/30/10/52, in order, with separate default bond returns', async function () {
    await ready();
    const [, agentBond, validatorBond] = await reserves();
    assert(agentBond > 0n && validatorBond > 0n, 'Exercise production-default nonzero bonds');
    const receipt = await send(manager.finalizeJob(0));
    const transfers = receipt.logs.filter(log => log.address.toLowerCase() === PIN.usdc.toLowerCase())
      .map(log => token.interface.parseLog(log)).filter(log => log && log.name === 'Transfer' && log.args.from === managerAddress);
    assert.deepEqual(transfers.map(log => log.args.to), [...recipients(), agent.address]);
    assert.deepEqual(transfers.map(log => log.args.value), [micro(8) + validatorBond, micro(30), micro(10), micro(52), agentBond]);
    await assertSettled();
    await rejectTransaction(manager.finalizeJob(0));
  });

  it('rolls back intake while native USDC is paused and resumes after Circle unpauses locally', async function () {
    const initialBalance = await token.balanceOf(employer.address);
    const initialAllowance = await token.allowance(employer.address, managerAddress);
    await send(token.connect(pauser).pause());
    assert.equal(await token.paused(), true);
    await rejectTransaction(manager.connect(employer).createJob('ipfs://fork', micro(100), 3600, 'paused issuer'));
    assert.equal(await manager.nextJobId(), 0n);
    assert.deepEqual(await reserves(), [0n, 0n, 0n, 0n]);
    assert.equal(await token.balanceOf(employer.address), initialBalance);
    assert.equal(await token.allowance(employer.address, managerAddress), initialAllowance);
    await send(token.connect(pauser).unpause());
    await ready();
    await send(manager.finalizeJob(0));
    await assertSettled();
  });

  for (const blocked of ['validator', 'wallet30', 'wallet10', 'agent', 'manager']) {
    it(`reserves native USDC for blacklisted ${blocked} without holding up eligible recipients`, async function () {
      await ready();
      const address = { validator: validator.address, wallet30: wallet30.address, wallet10: wallet10.address, agent: agent.address, manager: managerAddress }[blocked];
      await send(token.connect(blacklister).blacklist(address));
      await send(manager.finalizeJob(0));
      assert.equal((await manager.getJobCore(0)).completed, true);
      assert.deepEqual(await reserves(), [0n, 0n, 0n, 0n]);
      const claims = await Promise.all(recipients().map(recipient => manager.pendingUSDC(recipient)));
      for (let i = 0; i < claims.length; i++) {
        const restricted = blocked === 'manager' || recipients()[i] === address;
        assert.equal(claims[i] > 0n, restricted);
        if (restricted) await rejectTransaction(manager.claimUSDC(recipients()[i]));
      }
      const reserved = claims.reduce((sum, value) => sum + value, 0n);
      assert.equal(await manager.lockedClaims(), reserved);
      assert.equal(await token.balanceOf(managerAddress), reserved);
      assert.equal(await manager.withdrawableUSDC(), 0n);
      await send(token.connect(blacklister).unBlacklist(address));
      for (let i = 0; i < claims.length; i++) if (claims[i]) await send(manager.claimUSDC(recipients()[i]));
      await assertSettled();
    });
  }

  it('reserves every entitlement during an issuer pause and pays only after USDC resumes', async function () {
    await ready();
    const beforeBalances = await balances(), escrow = await token.balanceOf(managerAddress);
    await send(token.connect(pauser).pause());
    await send(manager.finalizeJob(0));
    assert.deepEqual(await balances(), beforeBalances);
    assert.deepEqual(await reserves(), [0n, 0n, 0n, 0n]);
    assert.equal(await manager.lockedClaims(), escrow);
    assert.equal(await manager.withdrawableUSDC(), 0n);
    for (const recipient of recipients()) await rejectTransaction(manager.claimUSDC(recipient));
    await send(token.connect(pauser).unpause());
    for (const recipient of recipients()) await send(manager.claimUSDC(recipient));
    await assertSettled();
  });

  async function protectedReview() {
    await send(manager.connect(employer).createJob('ipfs://review',micro(100),3600,'additional authorized review capacity'));
    await send(manager.connect(agent).applyForJob(0,'',[]));
    await send(manager.connect(agent).requestJobCompletion(0,'ipfs://protected-delivery'));
    const escrow=await (await ethers.getContractFactory('AGIReviewEscrow')).deploy(managerAddress);await escrow.waitForDeployment();
    await send(token.connect(employer).approve(await escrow.getAddress(),micro(8)));
    const startBy=(await ethers.provider.getBlock('latest')).timestamp+3600;
    await send(escrow.connect(employer).fundReview(0,validator.address,ethers.keccak256(ethers.toUtf8Bytes('ipfs://protected-delivery')),micro(8),startBy));
    return {escrow,id:await escrow.assignmentId(0,validator.address)};
  }
  it('pays an authorized reviewer before a vote and preserves the fee across buyer acceptance',async function(){
    const before=await token.balanceOf(validator.address),{escrow,id}=await protectedReview();
    await send(escrow.connect(validator).activateReview(id));await send(escrow.withdrawCredit(validator.address));
    await send(manager.connect(employer).acceptJob(0));
    assert.equal(await token.balanceOf(validator.address)-before,micro(8));assert.equal(await escrow.totalLiability(),0n);
    assert.equal(await token.balanceOf(await escrow.getAddress()),0n);assert.equal((await manager.getJobCore(0)).completed,true);
    await rejectTransaction(escrow.connect(employer).refundReview(id));
  });
  for(const restriction of ['pause','blacklist'])it(`retains the reviewer's native-USDC credit during ${restriction} and collects it after recovery`,async function(){
    const {escrow,id}=await protectedReview();await send(escrow.connect(validator).activateReview(id));
    if(restriction==='pause')await send(token.connect(pauser).pause());else await send(token.connect(blacklister).blacklist(validator.address));
    await rejectTransaction(escrow.withdrawCredit(validator.address));assert.equal(await escrow.credits(validator.address),micro(8));assert.equal(await escrow.totalLiability(),micro(8));
    if(restriction==='pause')await send(token.connect(pauser).unpause());else await send(token.connect(blacklister).unBlacklist(validator.address));
    await send(escrow.withdrawCredit(validator.address));assert.equal(await escrow.credits(validator.address),0n);assert.equal(await escrow.totalLiability(),0n);
  });
});
