async function getJob(manager, jobId) {
  const [
    employer,
    assignedAgent,
    payout,
    duration,
    assignedAt,
    completed,
    disputed,
    expired,
    agentPayoutPct,
  ] = await manager.getJobCore(jobId);
  const [
    completionRequested,
    validatorApprovals,
    validatorDisapprovals,
    completionRequestedAt,
    disputedAt,
  ] = await manager.getJobValidation(jobId);
  const [jobSpecURI, jobCompletionURI, ipfsHash, details] = await manager.getJobURIs(jobId);

  return {
    id: jobId,
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

module.exports = { getJob };
