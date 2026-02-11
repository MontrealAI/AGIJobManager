const { BN, time, expectRevert } = require('@openzeppelin/test-helpers');

const AGIJobManager = artifacts.require('AGIJobManager');
const MockERC20 = artifacts.require('MockERC20');
const MockERC721 = artifacts.require('MockERC721');
const MockENSRegistry = artifacts.require('MockENSRegistry');
const MockNameWrapper = artifacts.require('MockNameWrapper');
const MockENSJobPagesReturnData = artifacts.require('MockENSJobPagesReturnData');
const MockRevertingENSRegistry = artifacts.require('MockRevertingENSRegistry');
const MockRevertingNameWrapper = artifacts.require('MockRevertingNameWrapper');

const { buildInitConfig } = require('./helpers/deploy');

const ZERO = '0x' + '00'.repeat(32);
const EMPTY_PROOF = [];

function makeRng(seed) {
  let state = seed >>> 0;
  return () => {
    state = (1664525 * state + 1013904223) >>> 0;
    return state;
  };
}

contract('mainnet readiness hardening', (accounts) => {
  const [owner, employer, agent, validator, other, a2, v2] = accounts;

  async function deployManager(token, ensAddr, wrapperAddr) {
    return AGIJobManager.new(
      ...buildInitConfig(token.address, 'ipfs://', ensAddr, wrapperAddr, ZERO, ZERO, ZERO, ZERO, ZERO, ZERO),
      { from: owner }
    );
  }

  it('enforces AGI withdrawal safety posture', async () => {
    const token = await MockERC20.new({ from: owner });
    const manager = await deployManager(token, (await MockENSRegistry.new({ from: owner })).address, (await MockNameWrapper.new({ from: owner })).address);
    const nft = await MockERC721.new({ from: owner });
    await manager.addAGIType(nft.address, 90, { from: owner });
    await nft.mint(agent, { from: owner });

    const payout = new BN(web3.utils.toWei('100'));
    await token.mint(employer, payout.mul(new BN('3')), { from: owner });
    await token.approve(manager.address, payout.mul(new BN('3')), { from: employer });
    await manager.createJob('spec', payout, 1000, 'd', { from: employer });

    await manager.pause({ from: owner });
    await token.mint(manager.address, payout, { from: owner });
    await manager.withdrawAGI(payout, { from: owner });

    await manager.unpause({ from: owner });
    await manager.createJob('spec2', payout, 1000, 'd', { from: employer });
    await manager.addAdditionalAgent(agent, { from: owner });
    await token.mint(agent, payout, { from: owner });
    await token.approve(manager.address, payout, { from: agent });
    await manager.applyForJob(1, 'agent', EMPTY_PROOF, { from: agent });

    await manager.pause({ from: owner });
    const available = await manager.withdrawableAGI();
    await expectRevert.unspecified(manager.withdrawAGI(available.add(new BN(1)), { from: owner }));
    if (!available.isZero()) {
      await manager.withdrawAGI(available, { from: owner });
    }

    const otherToken = await MockERC20.new({ from: owner });
    await otherToken.mint(manager.address, web3.utils.toWei('2'), { from: owner });
    await manager.unpause({ from: owner });
    await expectRevert.unspecified(manager.withdrawAGI(web3.utils.toWei('1'), { from: owner }));
  });

  it('ENS tokenURI hook decode is strictly best effort', async () => {
    const token = await MockERC20.new({ from: owner });
    const manager = await deployManager(token, (await MockENSRegistry.new({ from: owner })).address, (await MockNameWrapper.new({ from: owner })).address);
    const nft = await MockERC721.new({ from: owner });
    await manager.addAGIType(nft.address, 90, { from: owner });
    await nft.mint(agent, { from: owner });

    const pages = await MockENSJobPagesReturnData.new({ from: owner });
    await manager.setEnsJobPages(pages.address, { from: owner });
    await manager.setUseEnsJobTokenURI(true, { from: owner });
    await manager.setCompletionReviewPeriod(1, { from: owner });
    await manager.addAdditionalAgent(agent, { from: owner });

    const payout = new BN(web3.utils.toWei('20'));
    await token.mint(employer, payout.mul(new BN('3')), { from: owner });
    await token.approve(manager.address, payout.mul(new BN('3')), { from: employer });
    await token.mint(agent, payout.mul(new BN('3')), { from: owner });
    await token.approve(manager.address, payout.mul(new BN('3')), { from: agent });

    for (let i = 0; i < 3; i++) {
      await pages.setMode(i, { from: owner });
      await manager.createJob(`spec-${i}`, payout, 1000, 'd', { from: employer });
      await manager.applyForJob(i, 'agent', EMPTY_PROOF, { from: agent });
      await manager.requestJobCompletion(i, `QmDone${i}`, { from: agent });
      await time.increase(2);
      await manager.finalizeJob(i, { from: employer });
      const uri = await manager.tokenURI(i);
      if (i < 2) {
        assert.equal(uri, `ipfs:///QmDone${i}`);
      } else {
        assert.equal(uri, 'ens://valid-uri');
      }
    }
  });

  it('ENS ownership verification failures never brick apply/validate', async () => {
    const token = await MockERC20.new({ from: owner });
    const revertingEns = await MockRevertingENSRegistry.new({ from: owner });
    const revertingWrapper = await MockRevertingNameWrapper.new({ from: owner });
    const manager = await deployManager(token, revertingEns.address, revertingWrapper.address);
    const nft = await MockERC721.new({ from: owner });
    await manager.addAGIType(nft.address, 90, { from: owner });
    await nft.mint(agent, { from: owner });

    const payout = new BN(web3.utils.toWei('30'));
    await token.mint(employer, payout.mul(new BN('2')), { from: owner });
    await token.approve(manager.address, payout.mul(new BN('2')), { from: employer });
    await manager.createJob('spec', payout, 1000, 'd', { from: employer });

    await manager.addAdditionalAgent(agent, { from: owner });
    await token.mint(agent, payout, { from: owner });
    await token.approve(manager.address, payout, { from: agent });
    await manager.applyForJob(0, 'will-revert-ens', EMPTY_PROOF, { from: agent });

    await manager.requestJobCompletion(0, 'done', { from: agent });
    await manager.addAdditionalValidator(validator, { from: owner });
    await token.mint(validator, payout, { from: owner });
    await token.approve(manager.address, payout, { from: validator });
    await manager.validateJob(0, 'still-reverting-ens', EMPTY_PROOF, { from: validator });
  });

  it('randomized settlement sequences preserve solvency invariants', async () => {
    const token = await MockERC20.new({ from: owner });
    const manager = await deployManager(token, (await MockENSRegistry.new({ from: owner })).address, (await MockNameWrapper.new({ from: owner })).address);

    const rng = makeRng(1337);
    const payout = new BN(web3.utils.toWei('10'));
    const actors = { employers: [employer, other], agents: [agent, a2], validators: [validator, v2] };

    for (const e of actors.employers) {
      await token.mint(e, payout.mul(new BN('50')), { from: owner });
      await token.approve(manager.address, payout.mul(new BN('50')), { from: e });
    }
    for (const a of actors.agents) {
      await token.mint(a, payout.mul(new BN('50')), { from: owner });
      await token.approve(manager.address, payout.mul(new BN('50')), { from: a });
      await manager.addAdditionalAgent(a, { from: owner });
    }
    for (const v of actors.validators) {
      await token.mint(v, payout.mul(new BN('50')), { from: owner });
      await token.approve(manager.address, payout.mul(new BN('50')), { from: v });
      await manager.addAdditionalValidator(v, { from: owner });
    }

    await manager.setCompletionReviewPeriod(1, { from: owner });

    const iterations = 28;
    for (let i = 0; i < iterations; i++) {
      const action = rng() % 6;
      const next = Number((await manager.nextJobId()).toString());
      const target = next === 0 ? 0 : rng() % next;
      try {
        if (action === 0) {
          const emp = actors.employers[rng() % actors.employers.length];
          await manager.createJob(`spec-${i}`, payout, 1000, 'd', { from: emp });
        } else if (action === 1) {
          const ag = actors.agents[rng() % actors.agents.length];
          await manager.applyForJob(target, `agent-${i}`, EMPTY_PROOF, { from: ag });
        } else if (action === 2) {
          const core = await manager.getJobCore(target);
          const assigned = core.assignedAgent;
          const completed = core.completed;
          const expired = core.expired;
          if (assigned !== '0x0000000000000000000000000000000000000000' && !completed && !expired) {
            await manager.requestJobCompletion(target, `done-${i}`, { from: assigned });
          }
        } else if (action === 3) {
          const val = actors.validators[rng() % actors.validators.length];
          await manager.validateJob(target, `validator-${i}`, EMPTY_PROOF, { from: val });
        } else if (action === 4) {
          await time.increase(2);
          const core = await manager.getJobCore(target);
          const jobEmployer = core.employer;
          const completed = core.completed;
          const disputed = core.disputed;
          const expired = core.expired;
          if (!completed && !expired && !disputed) {
            await manager.finalizeJob(target, { from: jobEmployer });
          }
        } else {
          await time.increase(1100);
          await manager.expireJob(target, { from: owner });
        }
      } catch (_) {
      }

      const bal = new BN((await token.balanceOf(manager.address)).toString());
      const locked = new BN((await manager.lockedEscrow()).toString())
        .add(new BN((await manager.lockedValidatorBonds()).toString()))
        .add(new BN((await manager.lockedAgentBonds()).toString()))
        .add(new BN((await manager.lockedDisputeBonds()).toString()));
      assert(bal.gte(locked), 'solvency invariant violated');

      const withdrawable = new BN((await manager.withdrawableAGI()).toString());
      assert(withdrawable.eq(bal.sub(locked)), 'withdrawable mismatch');

      for (const sampledAgent of actors.agents) {
        let unsettledAssigned = 0;
        const totalJobs = Number((await manager.nextJobId()).toString());
        for (let j = 0; j < totalJobs; j++) {
          const core = await manager.getJobCore(j);
          const assigned = core.assignedAgent;
          const completed = core.completed;
          const expired = core.expired;
          if (assigned === sampledAgent && !completed && !expired) {
            unsettledAssigned++;
          }
        }
        assert(unsettledAssigned <= 3, 'agent active jobs exceeded cap');
      }
    }
  });
});
