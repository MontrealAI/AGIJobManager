const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { time } = require('@openzeppelin/test-helpers');

const AGIJobManager = artifacts.require('AGIJobManager');
const MockERC20 = artifacts.require('MockERC20');
const MockENS = artifacts.require('MockENS');
const MockResolver = artifacts.require('MockResolver');
const MockERC721 = artifacts.require('MockERC721');
const MockNameWrapper = artifacts.require('MockNameWrapper');

const { runExportMetrics, mergeDisputeResolutionEvents } = require('../scripts/erc8004/export_metrics');
const { buildInitConfig } = require('./helpers/deploy');
const { fundValidators, fundAgents } = require('./helpers/bonds');

const ZERO_ROOT = '0x' + '00'.repeat(32);
const EMPTY_PROOF = [];
const { toBN, toWei } = web3.utils;

contract('ERC-8004 adapter export (smoke test)', (accounts) => {
  const [owner, employer, agent, validator, moderator] = accounts;
  let token;
  let ens;
  let resolver;
  let nameWrapper;
  let manager;

  const payout = toBN(toWei('10'));

  async function createJob() {
    await token.mint(employer, payout, { from: owner });
    await token.approve(manager.address, payout, { from: employer });
    const tx = await manager.createJob('ipfs-job', payout, 3600, 'details', { from: employer });
    return tx.logs[0].args.jobId.toNumber();
  }

  beforeEach(async () => {
    token = await MockERC20.new({ from: owner });
    ens = await MockENS.new({ from: owner });
    resolver = await MockResolver.new({ from: owner });
    nameWrapper = await MockNameWrapper.new({ from: owner });

    manager = await AGIJobManager.new(...buildInitConfig(
        token.address,
        'ipfs://base',
        ens.address,
        nameWrapper.address,
        ZERO_ROOT,
        ZERO_ROOT,
        ZERO_ROOT,
        ZERO_ROOT,
        ZERO_ROOT,
        ZERO_ROOT,
      ),
      { from: owner }
    );

    const agiType = await MockERC721.new({ from: owner });
    await agiType.mint(agent, { from: owner });
    await manager.addAGIType(agiType.address, 80, { from: owner });

    await manager.setRequiredValidatorApprovals(1, { from: owner });
    await manager.setRequiredValidatorDisapprovals(1, { from: owner });
    await manager.addAdditionalAgent(agent, { from: owner });
    await manager.addAdditionalValidator(validator, { from: owner });
    await manager.addModerator(moderator, { from: owner });

    await fundValidators(token, manager, [validator], owner);
    await fundAgents(token, manager, [agent], owner);
  });


  it('deduplicates legacy and typed dispute events for the same settlement', async () => {
    const legacy = {
      event: 'DisputeResolved',
      transactionHash: '0xabc',
      blockNumber: 10,
      logIndex: 1,
      returnValues: { jobId: '7', resolution: 'employer win' },
    };
    const typed = {
      event: 'DisputeResolvedWithCode',
      transactionHash: '0xabc',
      blockNumber: 10,
      logIndex: 2,
      returnValues: { jobId: '7', resolutionCode: '2', reason: 'employer win' },
    };
    const merged = mergeDisputeResolutionEvents([legacy], [typed]);
    assert.strictEqual(merged.length, 1, 'same settlement should not be double-counted');
    assert.strictEqual(merged[0].event, 'DisputeResolvedWithCode', 'typed event should be preferred');
  });


  it('deduplicates mixed legacy/typed NO_ACTION dispute events by tx and job', async () => {
    const legacy = {
      event: 'DisputeResolved',
      transactionHash: '0xdef',
      blockNumber: 11,
      logIndex: 1,
      returnValues: { jobId: '9', resolution: 'employer win' },
    };
    const typedNoAction = {
      event: 'DisputeResolvedWithCode',
      transactionHash: '0xdef',
      blockNumber: 11,
      logIndex: 2,
      returnValues: { jobId: '9', resolutionCode: '0', reason: 'employer win' },
    };
    const merged = mergeDisputeResolutionEvents([legacy], [typedNoAction]);
    assert.strictEqual(merged.length, 1, 'same tx+job settlement should not be double-counted');
    assert.strictEqual(merged[0].event, 'DisputeResolvedWithCode', 'typed event should be preferred');
  });

  it('exports deterministic metrics and expected aggregates', async () => {
    const jobId1 = await createJob();
    await manager.applyForJob(jobId1, 'agent', EMPTY_PROOF, { from: agent });
    await manager.requestJobCompletion(jobId1, 'ipfs-complete', { from: agent });
    await manager.validateJob(jobId1, 'club', EMPTY_PROOF, { from: validator });
    await manager.setChallengePeriodAfterApproval(1, { from: owner });
    await time.increase(2);
    await manager.finalizeJob(jobId1, { from: employer });

    const jobId2 = await createJob();
    await manager.applyForJob(jobId2, 'agent', EMPTY_PROOF, { from: agent });
    await manager.requestJobCompletion(jobId2, 'ipfs-disputed', { from: agent });
    await manager.disapproveJob(jobId2, 'club', EMPTY_PROOF, { from: validator });
    await manager.resolveDisputeWithCode(jobId2, 2, 'employer win', { from: moderator });

    const jobId3 = await createJob();
    await manager.applyForJob(jobId3, 'agent', EMPTY_PROOF, { from: agent });
    await manager.requestJobCompletion(jobId3, 'ipfs-no-action', { from: agent });
    await manager.disapproveJob(jobId3, 'club', EMPTY_PROOF, { from: validator });
    // NO_ACTION should remain unresolved for win/loss aggregates even if reason text is misleading.
    await manager.resolveDisputeWithCode(jobId3, 0, 'employer win', { from: moderator });

    const toBlock = await web3.eth.getBlockNumber();
    const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'erc8004-'));

    const first = await runExportMetrics({
      address: manager.address,
      fromBlock: 0,
      toBlock,
      outDir,
      includeValidators: true,
      generatedAt: '2026-01-29T00:00:00.000Z',
      toolVersion: 'test-runner',
      network: 'test',
    });

    const second = await runExportMetrics({
      address: manager.address,
      fromBlock: 0,
      toBlock,
      outDir,
      includeValidators: true,
      generatedAt: '2026-01-29T00:00:00.000Z',
      toolVersion: 'test-runner',
      network: 'test',
    });

    const metrics = JSON.parse(fs.readFileSync(first.outPath, 'utf8'));
    assert.deepStrictEqual(first.output, second.output, 'output should be deterministic');

    const agentKey = agent.toLowerCase();
    assert.ok(metrics.agents[agentKey], 'agent metrics should exist');
    assert.strictEqual(metrics.agents[agentKey].jobsAssigned, 3);
    assert.strictEqual(metrics.agents[agentKey].jobsCompletionRequested, 3);
    assert.strictEqual(metrics.agents[agentKey].jobsCompleted, 1);
    assert.strictEqual(metrics.agents[agentKey].jobsDisputed, 2);
    assert.strictEqual(metrics.agents[agentKey].employerWins, 1);
    assert.strictEqual(metrics.agents[agentKey].agentWins, 0);
    assert.strictEqual(metrics.agents[agentKey].unknownResolutions, 1);

    const validatorKey = validator.toLowerCase();
    assert.ok(metrics.validators[validatorKey], 'validator metrics should exist');
    assert.strictEqual(metrics.validators[validatorKey].approvals, 1);
    assert.strictEqual(metrics.validators[validatorKey].disapprovals, 2);
  });
});
