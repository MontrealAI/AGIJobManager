const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const AGIJobManager = artifacts.require('AGIJobManager');
const MockERC20 = artifacts.require('MockERC20');
const MockENS = artifacts.require('MockENS');
const MockResolver = artifacts.require('MockResolver');
const MockNameWrapper = artifacts.require('MockNameWrapper');

const { runExportFeedback } = require('../scripts/erc8004/export_feedback');

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

    manager = await AGIJobManager.new(
      token.address,
      'ipfs://base',
      ens.address,
      nameWrapper.address,
      ZERO_ROOT,
      ZERO_ROOT,
      ZERO_ROOT,
      ZERO_ROOT,
      { from: owner }
    );

    await manager.setRequiredValidatorApprovals(1, { from: owner });
    await manager.setRequiredValidatorDisapprovals(1, { from: owner });
    await manager.addAdditionalAgent(agent, { from: owner });
    await manager.addAdditionalValidator(validator, { from: owner });
    await manager.addModerator(moderator, { from: owner });
  });

  it('exports deterministic feedback artifacts and expected aggregates', async () => {
    const jobId1 = await createJob();
    await manager.applyForJob(jobId1, 'agent', EMPTY_PROOF, { from: agent });
    await manager.requestJobCompletion(jobId1, 'ipfs-complete', { from: agent });
    await manager.validateJob(jobId1, 'club', EMPTY_PROOF, { from: validator });

    const jobId2 = await createJob();
    await manager.applyForJob(jobId2, 'agent', EMPTY_PROOF, { from: agent });
    await manager.disapproveJob(jobId2, 'club', EMPTY_PROOF, { from: validator });
    await manager.resolveDispute(jobId2, 'employer win', { from: moderator });

    const toBlock = await web3.eth.getBlockNumber();
    const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'erc8004-'));

    const agentIdMap = {
      [agent.toLowerCase()]: 1,
      [validator.toLowerCase()]: 2,
    };

    const first = await runExportFeedback({
      address: manager.address,
      fromBlock: 0,
      toBlock,
      outDir,
      includeValidators: true,
      generatedAt: '2026-01-29T00:00:00.000Z',
      toolVersion: 'test-runner',
      network: 'test',
      identityRegistry: '0x0000000000000000000000000000000000000001',
      namespace: 'eip155',
      agentIdMap,
    });

    const second = await runExportFeedback({
      address: manager.address,
      fromBlock: 0,
      toBlock,
      outDir,
      includeValidators: true,
      generatedAt: '2026-01-29T00:00:00.000Z',
      toolVersion: 'test-runner',
      network: 'test',
      identityRegistry: '0x0000000000000000000000000000000000000001',
      namespace: 'eip155',
      agentIdMap,
    });

    const summary = JSON.parse(fs.readFileSync(first.summaryPath, 'utf8'));
    assert.deepStrictEqual(first.summary, second.summary, 'output should be deterministic');

    const agentKey = agent.toLowerCase();
    assert.ok(summary.subjects.agents[agentKey], 'agent summary should exist');
    assert.strictEqual(summary.subjects.agents[agentKey].assignedCount, 2);
    assert.strictEqual(summary.subjects.agents[agentKey].completionRequestedCount, 1);
    assert.strictEqual(summary.subjects.agents[agentKey].completedCount, 1);
    assert.strictEqual(summary.subjects.agents[agentKey].disputedCount, 1);
    assert.strictEqual(summary.subjects.agents[agentKey].employerWinCount, 1);
    assert.strictEqual(summary.subjects.agents[agentKey].agentWinCount, 0);
    assert.strictEqual(summary.subjects.agents[agentKey].unknownResolutionCount, 0);

    const validatorKey = validator.toLowerCase();
    assert.ok(summary.subjects.validators[validatorKey], 'validator summary should exist');
    assert.strictEqual(summary.subjects.validators[validatorKey].validationsCount, 1);
    assert.strictEqual(summary.subjects.validators[validatorKey].disapprovalsCount, 1);

    const agentFile = path.join(outDir, summary.subjects.agents[agentKey].file);
    const agentFeedback = JSON.parse(fs.readFileSync(agentFile, 'utf8'));
    assert.strictEqual(agentFeedback.type, 'https://eips.ethereum.org/EIPS/eip-8004#reputation-v1');
    assert.strictEqual(agentFeedback.agentId, 1);
    assert.ok(Array.isArray(agentFeedback.feedback));
  });
});
