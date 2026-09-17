const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const html = fs.readFileSync(path.join(__dirname, '../ui/agijobmanager-usdc.html'), 'utf8');
const source = (start, end) => html.slice(html.indexOf(start), html.indexOf(end, html.indexOf(start)));

function harness({ required = true, score = '1', failedRead = false } = {}) {
  const calls = [];
  const values = { agentNftRequired: required, validationRewardPercentage: '8', wallet30: '0x30', wallet10: '0x10',
    maxJobPayout: '1000000000', jobDurationLimit: '1000', paused: false };
  const method = (name, value) => (...args) => ({ call: async () => { calls.push({ name, args }); return value(); } });
  const methods = Object.fromEntries(Object.keys(values).map(name => [name, method(name, () => values[name])]));
  methods.jobAgentNftRequired = method('jobAgentNftRequired', () => { if (failedRead) throw new Error('RPC unavailable'); return required; });
  methods.getHighestPayoutPercentage = method('getHighestPayoutPercentage', () => score);
  const ctx = vm.createContext({ agiJobManager: { methods }, userAccount: 'agent' });
  vm.runInContext(source('function assertSnapshotMatch(', 'async function fetchAgentBondSnapshot('), ctx);
  vm.runInContext(source('function nftRequirementLabel(', 'async function createJob('), ctx);
  return { ctx, calls, values };
}

describe('USDC console NFT policy', () => {
  it('uses the job snapshot and skips NFT balance reads when the job does not require one', async () => {
    const { ctx, calls, values } = harness({ required: false });
    values.agentNftRequired = true;
    assert.equal(await ctx.assertAgentNftEligibility(0), false);
    assert.deepEqual(calls, [{ name: 'jobAgentNftRequired', args: ['0'] }]);
  });
  it('blocks a required job without an enabled credential and accepts a positive score', async () => {
    await assert.rejects(harness({ score: '0' }).ctx.assertAgentNftEligibility(7), /requires an NFT/);
    assert.equal(await harness({ score: '100' }).ctx.assertAgentNftEligibility(7), true);
  });
  it('fails closed on unavailable or malformed job policy reads', async () => {
    await assert.rejects(harness({ failedRead: true }).ctx.assertAgentNftEligibility(2), /RPC unavailable/);
    for (const required of [null, undefined, 'false', 0]) {
      const { ctx } = harness({ required: required === undefined ? null : required });
      await assert.rejects(ctx.assertAgentNftEligibility(2), /Unable to verify/);
    }
  });
  it('shows unknown distinctly from an optional NFT policy', () => {
    const { ctx } = harness();
    assert.equal(ctx.nftRequirementLabel(true), 'Required');
    assert.equal(ctx.nftRequirementLabel(false), 'Not required');
    assert.match(ctx.nftRequirementLabel(null), /Unknown/);
  });
  it('blocks reviewed job posting when the owner changes the default before submission', async () => {
    const { ctx, values } = harness();
    const reviewed = await ctx.fetchPostingTerms();
    assert.equal(reviewed.agentNftRequired, 'true');
    values.agentNftRequired = false;
    await assert.rejects(ctx.assertPostingTerms(reviewed), /Calculation mismatch/);
  });
  it('does not treat a malformed posting default as false', async () => {
    const { ctx, values } = harness();
    values.agentNftRequired = undefined;
    await assert.rejects(ctx.fetchPostingTerms(), /Unable to verify/);
  });
});
