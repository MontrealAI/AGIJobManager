async function getJob(manager, jobId) {
  const state = await manager.getJobState(jobId);
  const validation = await manager.getJobValidation(jobId);
  const metadata = await manager.getJobMetadata(jobId);

  const employer = state[0];
  const assignedAgent = state[1];
  const payout = state[2];
  const duration = state[3];
  const assignedAt = state[4];
  const completed = state[5];
  const disputed = state[6];
  const expired = state[7];
  const agentPayoutPct = state[8];

  const completionRequested = validation[0];
  const validatorApprovals = validation[1];
  const validatorDisapprovals = validation[2];
  const completionRequestedAt = validation[3];
  const disputedAt = validation[4];

  const jobSpecURI = metadata[0];
  const jobCompletionURI = metadata[1];
  const details = metadata[2];

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
