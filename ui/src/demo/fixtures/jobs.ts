export const demoPlatform = {
  owner: '0x1111111111111111111111111111111111111111',
  paused: false,
  settlementPaused: false,
  nextJobId: 6n,
  completionReviewPeriod: 86400n,
  disputeReviewPeriod: 172800n,
  voteQuorum: 2n,
  requiredValidatorApprovals: 2n,
  requiredValidatorDisapprovals: 2n,
  withdrawableAGI: 0n,
  degradedRpc: false,
  lastBlock: 20000000n
} as const;

export const demoJobs = [
  { id: 0n, core: ['0xaaaa000000000000000000000000000000000000', '0x0000000000000000000000000000000000000000', 1000000000000000000n, 86400n, 0n, false, false, false], val: [false, 0n, 0n, 0n, 0n], spec: 'https://example.com/spec/0', completion: '' },
  { id: 1n, core: ['0xaaaa000000000000000000000000000000000000', '0xbbbb000000000000000000000000000000000000', 2000000000000000000n, 86400n, 1700000000n, false, false, false], val: [false, 0n, 0n, 0n, 0n], spec: 'ipfs://bafybeigdemo1', completion: '' },
  { id: 2n, core: ['0xcccc000000000000000000000000000000000000', '0xdddd000000000000000000000000000000000000', 3000000000000000000n, 86400n, 1700000000n, false, false, false], val: [true, 2n, 0n, 1700004000n, 0n], spec: 'ens://agi-job.eth', completion: 'https://example.com/completion/2' },
  { id: 3n, core: ['0xcccc000000000000000000000000000000000000', '0xdddd000000000000000000000000000000000000', 4000000000000000000n, 86400n, 1700000000n, false, true, false], val: [true, 1n, 1n, 1700004000n, 1700010000n], spec: 'javascript:alert(1)', completion: 'https://example.com/completion/3' },
  { id: 4n, core: ['0xeeee000000000000000000000000000000000000', '0xffff000000000000000000000000000000000000', 5000000000000000000n, 86400n, 1700000000n, true, false, false], val: [true, 2n, 0n, 1700004000n, 0n], spec: 'https://example.com/spec/4', completion: 'https://example.com/completion/4' },
  { id: 5n, core: ['0xeeee000000000000000000000000000000000000', '0xffff000000000000000000000000000000000000', 999999999999999999999999n, 86400n, 1700000000n, false, false, true], val: [false, 0n, 0n, 0n, 0n], spec: 'data:text/html,test', completion: '' }
] as const;

export const demoTimeline = {
  2: ['JobCreated', 'JobAssigned', 'CompletionRequested'],
  3: ['JobCreated', 'JobAssigned', 'CompletionRequested', 'JobDisputed'],
  4: ['JobCreated', 'JobAssigned', 'CompletionRequested', 'JobFinalized'],
  5: ['JobCreated', 'Expired']
} as const;
