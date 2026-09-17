'use strict';

const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { createRuntime } = require('./test-runtime.cjs');
const { buildInitConfig } = require('../test/helpers/deploy');

async function main() {
  const root = path.resolve(__dirname, '..');
  const config = path.join(root, 'hardhat.config.mjs');
  const { createHardhatRuntimeEnvironment } = await import(pathToFileURL(require.resolve('hardhat/hre', { paths: [path.join(root, 'hardhat')] })));
  const configuration = (await import(pathToFileURL(config))).default;
  const hre = await createHardhatRuntimeEnvironment(configuration, { config }, root);
  const connection = await hre.network.connect('hardhat');
  try {
    const runtime = await createRuntime(connection.provider);
    const [owner, employer, agent, validator, , , , , wallet30, wallet10] = runtime.accounts;
    const token = await runtime.artifacts.require('MockERC20').new();
    const zero = '0x' + '00'.repeat(20);
    const rootNode = '0x' + '00'.repeat(32);
    const manager = await runtime.artifacts.require('AGIJobManager').new(...buildInitConfig(
      token.address, 'ipfs://', zero, zero, rootNode, rootNode, rootNode, rootNode, rootNode, rootNode,
      [wallet30, wallet10],
    ));
    assert.equal(await manager.paused(), true);
    const credential = await runtime.artifacts.require('MockERC721').new();
    await credential.mint(agent);
    await manager.addAGIType(credential.address, 1);
    await manager.addAdditionalAgent(agent);
    await manager.addAdditionalValidator(validator);
    await manager.setRequiredValidatorApprovals(1);
    await manager.setVoteQuorum(1);
    await manager.setChallengePeriodAfterApproval(1);
    await manager.setCompletionReviewPeriod(300);
    for (const account of [employer, agent, validator]) {
      await token.mint(account, '100000000');
      await token.approve(manager.address, '100000000', { from: account });
    }
    await manager.unpauseIntake({ from: owner });
    const recipients = [validator, wallet30, wallet10, agent];
    const before = await Promise.all(recipients.map(async address => BigInt((await token.balanceOf(address)).toString())));
    const posted = await manager.createJob('ipfs://job-spec', '100000000', 3600, 'Local rehearsal', { from: employer });
    const jobId = posted.logs.find(log => log.event === 'JobCreated').args.jobId;
    await manager.applyForJob(jobId, '', [], { from: agent });
    await manager.requestJobCompletion(jobId, 'ipfs://job-result', { from: agent });
    await manager.validateJob(jobId, '', [], { from: validator });
    await connection.provider.request({ method: 'evm_increaseTime', params: [301] });
    await connection.provider.request({ method: 'evm_mine', params: [] });
    await manager.finalizeJob(jobId, { from: employer });
    const after = await Promise.all(recipients.map(async address => BigInt((await token.balanceOf(address)).toString())));
    const amounts = after.map((value, index) => value - before[index]);
    assert.deepEqual(amounts, [8_000_000n, 30_000_000n, 10_000_000n, 52_000_000n]);
    for (const getter of ['lockedEscrow', 'lockedAgentBonds', 'lockedValidatorBonds', 'lockedDisputeBonds', 'lockedClaims']) {
      assert.equal((await manager[getter]()).toString(), '0', getter);
    }
    assert.equal((await token.balanceOf(manager.address)).toString(), '0');
    console.log('Local simulated job completed; no public-network transactions.');
    console.table(['Validators', '30% wallet', '10% wallet', 'Agent'].map((recipient, index) => ({ recipient, USDC: Number(amounts[index]) / 1e6 })));
    console.log('Agent and validator bonds returned; all reserves and manager USDC balance are zero.');
  } finally {
    await connection.close();
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
