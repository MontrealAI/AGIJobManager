export const agiJobManagerAbi = [
  { type: 'function', name: 'owner', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
  { type: 'function', name: 'paused', stateMutability: 'view', inputs: [], outputs: [{ type: 'bool' }] },
  { type: 'function', name: 'settlementPaused', stateMutability: 'view', inputs: [], outputs: [{ type: 'bool' }] },
  { type: 'function', name: 'nextJobId', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'moderators', stateMutability: 'view', inputs: [{ type: 'address' }], outputs: [{ type: 'bool' }] },
  { type: 'function', name: 'getJobCore', stateMutability: 'view', inputs: [{ type: 'uint256' }], outputs: [{ type: 'tuple', components: [
    { name: 'employer', type: 'address' }, { name: 'agent', type: 'address' }, { name: 'payout', type: 'uint256' },
    { name: 'createdAt', type: 'uint64' }, { name: 'assignedAt', type: 'uint64' }, { name: 'duration', type: 'uint64' },
    { name: 'completionRequestedAt', type: 'uint64' }, { name: 'validatorApprovedAt', type: 'uint64' }, { name: 'disputedAt', type: 'uint64' },
    { name: 'completed', type: 'bool' }, { name: 'cancelled', type: 'bool' }
  ] }] },
  { type: 'function', name: 'getJobValidation', stateMutability: 'view', inputs: [{ type: 'uint256' }], outputs: [{ type: 'tuple', components: [
    { name: 'approvals', type: 'uint32' }, { name: 'disapprovals', type: 'uint32' }, { name: 'disputed', type: 'bool' }
  ] }] },
  { type: 'function', name: 'getJobSpecURI', stateMutability: 'view', inputs: [{ type: 'uint256' }], outputs: [{ type: 'string' }] },
  { type: 'function', name: 'getJobCompletionURI', stateMutability: 'view', inputs: [{ type: 'uint256' }], outputs: [{ type: 'string' }] },
  { type: 'function', name: 'completionReviewPeriod', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'disputeReviewPeriod', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'challengePeriodAfterApproval', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'requiredValidatorApprovals', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'requiredValidatorDisapprovals', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'voteQuorum', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'cancelJob', stateMutability: 'nonpayable', inputs: [{ type: 'uint256' }], outputs: [] },
  { type: 'function', name: 'applyForJob', stateMutability: 'nonpayable', inputs: [{ type: 'uint256' },{ type: 'bytes32[]' }], outputs: [] },
  { type: 'function', name: 'requestCompletion', stateMutability: 'nonpayable', inputs: [{ type: 'uint256' }, { type: 'string' }], outputs: [] },
  { type: 'function', name: 'disputeJob', stateMutability: 'nonpayable', inputs: [{ type: 'uint256' }], outputs: [] },
  { type: 'function', name: 'finalizeJob', stateMutability: 'nonpayable', inputs: [{ type: 'uint256' }], outputs: [] },
  { type: 'function', name: 'pause', stateMutability: 'nonpayable', inputs: [], outputs: [] },
  { type: 'function', name: 'unpause', stateMutability: 'nonpayable', inputs: [], outputs: [] },
  { type: 'function', name: 'setSettlementPaused', stateMutability: 'nonpayable', inputs: [{ type: 'bool' }], outputs: [] },
  { type: 'event', name: 'JobCreated', inputs: [{ indexed: true, name: 'jobId', type: 'uint256' }], anonymous: false },
  { type: 'event', name: 'JobCompletionRequested', inputs: [{ indexed: true, name: 'jobId', type: 'uint256' }], anonymous: false },
  { type: 'event', name: 'JobDisputed', inputs: [{ indexed: true, name: 'jobId', type: 'uint256' }], anonymous: false },
  { type: 'event', name: 'JobCompleted', inputs: [{ indexed: true, name: 'jobId', type: 'uint256' }], anonymous: false },
  { type: 'error', name: 'NotAuthorized', inputs: [] },
  { type: 'error', name: 'JobNotFound', inputs: [] },
  { type: 'error', name: 'InvalidState', inputs: [] }
] as const
