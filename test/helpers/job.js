async function readJob(manager, jobId) {
  const core = await manager.getJobCore(jobId);
  const validation = await manager.getJobValidation(jobId);
  const metadata = await manager.getJobMetadata(jobId);

  const employer = core.employer ?? core[0];
  const assignedAgent = core.assignedAgent ?? core[1];
  const payout = core.payout ?? core[2];
  const duration = core.duration ?? core[3];
  const assignedAt = core.assignedAt ?? core[4];
  const completed = core.completed ?? core[5];
  const disputed = core.disputed ?? core[6];
  const expired = core.expired ?? core[7];
  const agentPayoutPct = core.agentPayoutPct ?? core[8];

  const completionRequested = validation.completionRequested ?? validation[0];
  const validatorApprovals = validation.validatorApprovals ?? validation[1];
  const validatorDisapprovals = validation.validatorDisapprovals ?? validation[2];
  const completionRequestedAt = validation.completionRequestedAt ?? validation[3];
  const disputedAt = validation.disputedAt ?? validation[4];

  const jobSpecURI = metadata.jobSpecURI ?? metadata[0];
  const jobCompletionURI = metadata.jobCompletionURI ?? metadata[1];
  const ipfsHash = metadata.ipfsHash ?? metadata[2];
  const details = metadata.details ?? metadata[3];

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
    ipfsHash,
    details,
  };
}

module.exports = {
  readJob,
};
