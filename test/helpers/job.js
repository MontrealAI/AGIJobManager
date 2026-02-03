function pick(value, index) {
  if (value === undefined || value === null) return value;
  if (value[index] !== undefined) return value[index];
  return value;
}

async function getJob(manager, jobId) {
  const core = await manager.getJobCore(jobId);
  const validation = await manager.getJobValidation(jobId);
  const uris = await manager.getJobUris(jobId);

  return {
    employer: core.employer ?? pick(core, 0),
    assignedAgent: core.assignedAgent ?? pick(core, 1),
    payout: core.payout ?? pick(core, 2),
    duration: core.duration ?? pick(core, 3),
    assignedAt: core.assignedAt ?? pick(core, 4),
    completed: core.completed ?? pick(core, 5),
    disputed: core.disputed ?? pick(core, 6),
    expired: core.expired ?? pick(core, 7),
    agentPayoutPct: core.agentPayoutPct ?? pick(core, 8),
    completionRequested: validation.completionRequested ?? pick(validation, 0),
    validatorApprovals: validation.validatorApprovals ?? pick(validation, 1),
    validatorDisapprovals: validation.validatorDisapprovals ?? pick(validation, 2),
    completionRequestedAt: validation.completionRequestedAt ?? pick(validation, 3),
    disputedAt: validation.disputedAt ?? pick(validation, 4),
    jobSpecURI: uris.jobSpecURI ?? pick(uris, 0),
    jobCompletionURI: uris.jobCompletionURI ?? pick(uris, 1),
    ipfsHash: uris.ipfsHash ?? pick(uris, 2),
  };
}

module.exports = {
  getJob,
};
