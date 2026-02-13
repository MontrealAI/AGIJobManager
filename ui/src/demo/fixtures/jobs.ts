export const demoPlatform = {
  owner: '0x1111111111111111111111111111111111111111',
  paused: false,
  settlementPaused: false,
  nextJobId: 6n,
  completionReviewPeriod: 86400n,
  disputeReviewPeriod: 172800n,
  voteQuorum: 3n,
  requiredValidatorApprovals: 2n,
  requiredValidatorDisapprovals: 2n,
  withdrawableAGI: 5000000000000000000n,
  degradedRpc: false
};

export const demoJobs = [
  { id: 0n, core: ['0xabc0000000000000000000000000000000000001', '0x0000000000000000000000000000000000000000', 1000000000000000000n, 86400n, 0n, false, false, false], val: [false, 0n, 0n, 0n, 0n], spec: 'https://example.com/spec/0', completion: '' },
  { id: 1n, core: ['0xabc0000000000000000000000000000000000002', '0xdef0000000000000000000000000000000000002', 2000000000000000000n, 90000n, 1700000000n, false, false, false], val: [false, 0n, 0n, 0n, 0n], spec: 'ipfs://QmAssigned', completion: '' },
  { id: 2n, core: ['0xabc0000000000000000000000000000000000003', '0xdef0000000000000000000000000000000000003', 3000000000000000000n, 90000n, 1700000000n, false, false, false], val: [true, 2n, 0n, 1700050000n, 0n], spec: 'ens://agi.eth/job/2', completion: 'https://example.com/completion/2' },
  { id: 3n, core: ['0xabc0000000000000000000000000000000000004', '0xdef0000000000000000000000000000000000004', 4000000000000000000n, 90000n, 1700000000n, false, true, false], val: [true, 1n, 1n, 1700050000n, 1700060000n], spec: 'javascript:alert(1)', completion: '' },
  { id: 4n, core: ['0xabc0000000000000000000000000000000000005', '0xdef0000000000000000000000000000000000005', 500000000000000000000000n, 90000n, 1700000000n, true, false, false], val: [true, 3n, 0n, 1700050000n, 0n], spec: 'https://example.com/spec/4', completion: 'ipfs://QmCompleted' },
  { id: 5n, core: ['0x0000000000000000000000000000000000000000', '0x0000000000000000000000000000000000000000', 0n, 0n, 0n, false, false, true], val: [false, 0n, 0n, 0n, 0n], spec: 'file://dangerous', completion: '' }
] as const;

export const demoTimeline: Record<string, Array<{ ts: string; event: string; note: string }>> = {
  '2': [
    { ts: '2024-01-01T10:00:00Z', event: 'JobCreated', note: 'Escrow funded by employer' },
    { ts: '2024-01-02T12:00:00Z', event: 'AgentAssigned', note: 'Agent accepted job' },
    { ts: '2024-01-03T08:00:00Z', event: 'CompletionRequested', note: 'Completion URI posted' }
  ],
  '3': [
    { ts: '2024-01-03T08:00:00Z', event: 'CompletionRequested', note: 'Under validator review' },
    { ts: '2024-01-03T12:00:00Z', event: 'JobDisputed', note: 'Escalated to moderator lane' }
  ]
};
