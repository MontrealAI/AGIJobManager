async function getJob(manager, jobId) {
  const core = await manager.getJobCore(jobId);
  const validation = await manager.getJobValidation(jobId);
  const uris = await manager.getJobUris(jobId);

  const employer = core[0];
  const assignedAgent = core[1];
  const payout = core[2];
  const duration = core[3];
  const assignedAt = core[4];
  const completed = core[5];
  const disputed = core[6];
  const expired = core[7];
  const agentPayoutPct = core[8];

  const completionRequested = validation[0];
  const validatorApprovals = validation[1];
  const validatorDisapprovals = validation[2];
  const completionRequestedAt = validation[3];
  const disputedAt = validation[4];

  const jobSpecURI = uris[0];
  const jobCompletionURI = uris[1];

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
  };
}

module.exports = {
  getJob,
};
