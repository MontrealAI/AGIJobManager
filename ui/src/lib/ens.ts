const ENS_JOB_NAMESPACE = 'jobs.agi.eth';

export function deriveJobEnsName(jobId: bigint | number | string, namespace = ENS_JOB_NAMESPACE): string {
  const normalizedNamespace = namespace.trim().toLowerCase();
  const suffix = normalizedNamespace.length > 0 ? normalizedNamespace : ENS_JOB_NAMESPACE;
  return `job-${jobId.toString().trim()}.${suffix}`;
}

export function deriveJobIdentitySnapshot(jobId: bigint | number | string) {
  const name = deriveJobEnsName(jobId);
  return {
    jobId: jobId.toString(),
    ensName: name,
    profileUri: `ens://${name}`,
    records: {
      textDescription: `AGIJobManager job ${jobId.toString()}`,
      contentHash: null
    }
  };
}

