async function getJob(manager, jobId) {
  const core = await manager.getJobCore(jobId);
  const meta = await manager.getJobMeta(jobId);

  const employer = core[0];
  const assignedAgent = core[1];
  const payout = core[2];
  const duration = core[3];
  const assignedAt = core[4];
  const completed = core[5];
  const disputed = core[6];
  const expired = core[7];
  const agentPayoutPct = core[8];

  const completionRequested = meta[0];
  const validatorApprovals = meta[1];
  const validatorDisapprovals = meta[2];
  const completionRequestedAt = meta[3];
  const disputedAt = meta[4];
  const jobSpecURI = meta[5];
  const jobCompletionURI = meta[6];
  const details = meta[7];

  return {
    employer,
    assignedAgent,
    payout,
    duration,
    assignedAt,
    completed,
    disputed,
    expired,
    agentPayoutPct,
    completionRequested,
    validatorApprovals,
    validatorDisapprovals,
    completionRequestedAt,
    disputedAt,
    jobSpecURI,
    jobCompletionURI,
    details,
  };
}

module.exports = {
  getJob,
};
