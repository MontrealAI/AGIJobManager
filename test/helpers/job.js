function readNamed(result, index, name) {
  if (result && result[name] !== undefined) return result[name];
  return result[index];
}

async function getJobCore(manager, jobId) {
  const result = await manager.getJobCore(jobId);
  return {
    employer: readNamed(result, 0, "employer"),
    assignedAgent: readNamed(result, 1, "assignedAgent"),
    payout: readNamed(result, 2, "payout"),
    duration: readNamed(result, 3, "duration"),
    assignedAt: readNamed(result, 4, "assignedAt"),
    completed: readNamed(result, 5, "completed"),
    disputed: readNamed(result, 6, "disputed"),
    expired: readNamed(result, 7, "expired"),
    agentPayoutPct: readNamed(result, 8, "agentPayoutPct"),
  };
}

async function getJobValidation(manager, jobId) {
  const result = await manager.getJobValidation(jobId);
  return {
    completionRequested: readNamed(result, 0, "completionRequested"),
    validatorApprovals: readNamed(result, 1, "validatorApprovals"),
    validatorDisapprovals: readNamed(result, 2, "validatorDisapprovals"),
    completionRequestedAt: readNamed(result, 3, "completionRequestedAt"),
    disputedAt: readNamed(result, 4, "disputedAt"),
  };
}

async function getJobUris(manager, jobId) {
  const result = await manager.getJobUris(jobId);
  return {
    jobSpecURI: readNamed(result, 0, "jobSpecURI"),
    jobCompletionURI: readNamed(result, 1, "jobCompletionURI"),
    ipfsHash: readNamed(result, 2, "ipfsHash"),
    details: readNamed(result, 3, "details"),
  };
}

async function getJob(manager, jobId) {
  const [core, validation, uris] = await Promise.all([
    getJobCore(manager, jobId),
    getJobValidation(manager, jobId),
    getJobUris(manager, jobId),
  ]);
  return { ...core, ...validation, ...uris };
}

module.exports = {
  getJob,
  getJobCore,
  getJobValidation,
  getJobUris,
};
