export type DemoJob = {
  id: number;
  employer: `0x${string}`;
  agent: `0x${string}`;
  payout: bigint;
  duration: bigint;
  assignedAt: bigint;
  completed: boolean;
  disputed: boolean;
  expired: boolean;
  completionRequested: boolean;
  completionRequestedAt: bigint;
  disputedAt: bigint;
  spec: string;
  completion: string;
  role: 'Employer'|'Agent'|'Validator'|'Moderator'|'Owner';
};

const base = 1700000000n;

export const demoJobs: DemoJob[] = [
  { id:0, employer:'0x1111111111111111111111111111111111111111', agent:'0x0000000000000000000000000000000000000000', payout:1000_000000000000000000n, duration:86400n, assignedAt:0n, completed:false, disputed:false, expired:false, completionRequested:false, completionRequestedAt:0n, disputedAt:0n, spec:'https://example.org/spec/open', completion:'', role:'Employer' },
  { id:1, employer:'0x1111111111111111111111111111111111111111', agent:'0x2222222222222222222222222222222222222222', payout:2500_000000000000000000n, duration:172800n, assignedAt:base, completed:false, disputed:false, expired:false, completionRequested:false, completionRequestedAt:0n, disputedAt:0n, spec:'ipfs://bafybeigdyrzt', completion:'', role:'Agent' },
  { id:2, employer:'0x3333333333333333333333333333333333333333', agent:'0x4444444444444444444444444444444444444444', payout:420_000000000000000000n, duration:86400n, assignedAt:base-10000n, completed:false, disputed:false, expired:false, completionRequested:true, completionRequestedAt:base+1000n, disputedAt:0n, spec:'ens://asi.jobs/job/2', completion:'https://example.org/completion/2', role:'Validator' },
  { id:3, employer:'0x3333333333333333333333333333333333333333', agent:'0x5555555555555555555555555555555555555555', payout:99_000000000000000000n, duration:86400n, assignedAt:base-20000n, completed:false, disputed:true, expired:false, completionRequested:true, completionRequestedAt:base-5000n, disputedAt:base-3000n, spec:'javascript:alert(1)', completion:'data:text/html,evil', role:'Moderator' },
  { id:4, employer:'0x7777777777777777777777777777777777777777', agent:'0x8888888888888888888888888888888888888888', payout:1000000000000000000000000000000000000n, duration:86400n, assignedAt:base-999999n, completed:true, disputed:false, expired:false, completionRequested:true, completionRequestedAt:base-900000n, disputedAt:0n, spec:'http://example.org/very/long', completion:'https://example.org/completion/4', role:'Owner' },
  { id:5, employer:'0x9999999999999999999999999999999999999999', agent:'0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', payout:100_000000000000000000n, duration:3600n, assignedAt:base-1000000n, completed:false, disputed:false, expired:true, completionRequested:false, completionRequestedAt:0n, disputedAt:0n, spec:'file:///tmp/nope', completion:'blob:https://bad', role:'Employer' }
];

export const demoTimeline = {
  2: ['JobCreated', 'AgentAssigned', 'CompletionRequested'],
  3: ['JobCreated', 'AgentAssigned', 'CompletionRequested', 'Disputed'],
  4: ['JobCreated', 'AgentAssigned', 'CompletionRequested', 'JobFinalized']
} as Record<number, string[]>;

export const demoPlatform = {
  owner: '0x7777777777777777777777777777777777777777',
  paused: false,
  settlementPaused: false,
  nextJobId: BigInt(demoJobs.length),
  completionReviewPeriod: 48n * 3600n,
  disputeReviewPeriod: 72n * 3600n,
  voteQuorum: 2n,
  requiredValidatorApprovals: 2n,
  requiredValidatorDisapprovals: 2n,
  withdrawableAGI: 123n * 10n ** 18n,
  degradedRpc: false
};
