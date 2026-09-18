const { time } = require('../../scripts/test-helpers.cjs');

async function finalizeAfterReview(manager, jobId, options = {}) {
  const deadlines = await manager.getJobDeadlines(jobId);
  const block = await web3.currentProvider.request({ method: 'eth_getBlockByNumber', params: ['latest', false] });
  const remaining = Number(deadlines.settlementAfter.toString()) - Number(block.timestamp) + 1;
  if (remaining > 0) await time.increase(remaining);
  return manager.finalizeJob(jobId, options);
}

module.exports = { finalizeAfterReview };
