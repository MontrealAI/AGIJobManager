export type DemoJob = {
  id: number;
  employer: `0x${string}`;
  agent: `0x${string}`;
  payout: bigint;
  duration: bigint;
  assignedAt: bigint;
  completionRequested: boolean;
  completionRequestedAt: bigint;
  disputedAt: bigint;
  completed: boolean;
  disputed: boolean;
  expired: boolean;
  specURI: string;
  completionURI: string;
  deleted?: boolean;
};

export type DemoScenario = {
  key: string;
  title: string;
  notes: string;
  paused: boolean;
  settlementPaused: boolean;
  degradedRpc: boolean;
  owner: `0x${string}`;
  nextJobId: bigint;
  completionReviewPeriod: bigint;
  disputeReviewPeriod: bigint;
  jobs: DemoJob[];
};

const A = '0x00000000000000000000000000000000000000aa' as const;
const B = '0x00000000000000000000000000000000000000bb' as const;
const C = '0x00000000000000000000000000000000000000cc' as const;
const Z = '0x0000000000000000000000000000000000000000' as const;

export const scenarios: DemoScenario[] = [
  {
    key: 'baseline',
    title: 'Baseline lifecycle mix',
    notes: 'Open/Assigned/CompletionRequested/Disputed/Settled/Expired and deleted slot.',
    paused: false,
    settlementPaused: false,
    degradedRpc: false,
    owner: A,
    nextJobId: 7n,
    completionReviewPeriod: 3600n,
    disputeReviewPeriod: 7200n,
    jobs: [
      { id: 0, employer: A, agent: Z, payout: 1000n, duration: 1000n, assignedAt: 0n, completionRequested: false, completionRequestedAt: 0n, disputedAt: 0n, completed: false, disputed: false, expired: false, specURI: 'https://example.org/spec/0', completionURI: '' },
      { id: 1, employer: A, agent: B, payout: 2000n, duration: 2000n, assignedAt: 100n, completionRequested: false, completionRequestedAt: 0n, disputedAt: 0n, completed: false, disputed: false, expired: false, specURI: 'ipfs://bafybeigdyr', completionURI: '' },
      { id: 2, employer: B, agent: C, payout: 3000n, duration: 3000n, assignedAt: 100n, completionRequested: true, completionRequestedAt: 500n, disputedAt: 0n, completed: false, disputed: false, expired: false, specURI: 'ens://job.eth/spec', completionURI: 'https://example.org/completion/2' },
      { id: 3, employer: B, agent: C, payout: 4000n, duration: 4000n, assignedAt: 100n, completionRequested: true, completionRequestedAt: 600n, disputedAt: 700n, completed: false, disputed: true, expired: false, specURI: 'javascript:alert(1)', completionURI: 'data:text/plain,blocked' },
      { id: 4, employer: C, agent: B, payout: 5000n, duration: 5000n, assignedAt: 100n, completionRequested: true, completionRequestedAt: 800n, disputedAt: 0n, completed: true, disputed: false, expired: false, specURI: 'https://example.org/spec/4', completionURI: 'https://example.org/completion/4' },
      { id: 5, employer: C, agent: B, payout: 6000n, duration: 6000n, assignedAt: 100n, completionRequested: false, completionRequestedAt: 0n, disputedAt: 0n, completed: false, disputed: false, expired: true, specURI: 'file:///etc/passwd', completionURI: '' },
      { id: 6, employer: A, agent: Z, payout: 999999999999999999999999999999999999n, duration: 1n, assignedAt: 0n, completionRequested: false, completionRequestedAt: 0n, disputedAt: 0n, completed: false, disputed: false, expired: false, specURI: 'https://example.org/huge', completionURI: '', deleted: true }
    ]
  },
  {
    key: 'paused-degraded',
    title: 'Paused + settlement paused + degraded RPC',
    notes: 'Exercises all global warning banners.',
    paused: true,
    settlementPaused: true,
    degradedRpc: true,
    owner: A,
    nextJobId: 1n,
    completionReviewPeriod: 1000n,
    disputeReviewPeriod: 2000n,
    jobs: [
      { id: 0, employer: A, agent: B, payout: 10n, duration: 10n, assignedAt: 1n, completionRequested: true, completionRequestedAt: 3n, disputedAt: 0n, completed: false, disputed: false, expired: false, specURI: 'http://example.org/spec', completionURI: 'http://example.org/completion' }
    ]
  }
];

export const getScenario = (key?: string): DemoScenario => scenarios.find((s) => s.key === key) ?? scenarios[0];
