export type DemoJobFixture = {
  id: bigint;
  core: readonly [`0x${string}`, `0x${string}`, bigint, bigint, bigint, boolean, boolean, boolean, number];
  val: readonly [boolean, bigint, bigint, bigint, bigint];
  spec: string;
  completion: string;
  timeline: Array<{ block: number; event: string; at: number; detail: string }>;
};

const ZERO = '0x0000000000000000000000000000000000000000' as const;

export const demoJobs: DemoJobFixture[] = [
  {
    id: 0n,
    core: ['0x1111111111111111111111111111111111111111', ZERO, 1_000000000000000000n, 86400n, 0n, false, false, false, 80],
    val: [false, 0n, 0n, 0n, 0n],
    spec: 'https://docs.montreal.ai/job/open/0',
    completion: '',
    timeline: [{ block: 19000000, event: 'JobCreated', at: 1720000000, detail: 'Open role posted by employer.' }]
  },
  {
    id: 1n,
    core: ['0x1111111111111111111111111111111111111111', '0x2222222222222222222222222222222222222222', 25_000000000000000000n, 172800n, 1720100000n, false, false, false, 80],
    val: [false, 0n, 0n, 0n, 0n],
    spec: 'ipfs://QmSovereignAssignedSpec',
    completion: '',
    timeline: [{ block: 19010000, event: 'Applied', at: 1720100001, detail: 'Agent bond posted and assignment completed.' }]
  },
  {
    id: 2n,
    core: ['0x3333333333333333333333333333333333333333', '0x4444444444444444444444444444444444444444', 15_000000000000000000n, 259200n, 1720200000n, false, false, false, 85],
    val: [true, 1n, 0n, 1720280000n, 0n],
    spec: 'ens://job.agent.eth/spec/2',
    completion: 'https://example.org/completion/2',
    timeline: [{ block: 19020001, event: 'CompletionRequested', at: 1720280000, detail: 'Agent requested settlement.' }]
  },
  {
    id: 3n,
    core: ['0x5555555555555555555555555555555555555555', '0x6666666666666666666666666666666666666666', 40_000000000000000000n, 259200n, 1720300000n, false, true, false, 75],
    val: [true, 2n, 1n, 1720360000n, 1720390000n],
    spec: 'javascript:alert(1)',
    completion: 'data:text/plain,unsafe',
    timeline: [{ block: 19030042, event: 'Disputed', at: 1720390000, detail: 'Employer disputed completion.' }]
  },
  {
    id: 4n,
    core: ['0x7777777777777777777777777777777777777777', '0x8888888888888888888888888888888888888888', 100_0000000000000000000000n, 604800n, 1719000000n, true, false, false, 80],
    val: [true, 3n, 0n, 1719050000n, 0n],
    spec: 'https://example.com/huge',
    completion: 'ipfs://QmSettlementReport',
    timeline: [{ block: 18990000, event: 'JobFinalized', at: 1719060000, detail: 'Finalized and NFT minted.' }]
  },
  {
    id: 5n,
    core: ['0x9999999999999999999999999999999999999999', '0xAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA', 5_000000000000000000n, 3600n, 1710000000n, false, false, true, 70],
    val: [false, 0n, 0n, 0n, 0n],
    spec: 'file:///etc/passwd',
    completion: '',
    timeline: [{ block: 18880000, event: 'JobExpired', at: 1710007200, detail: 'Job expired due to timeout.' }]
  }
];

export const demoPlatform = {
  owner: '0x1111111111111111111111111111111111111111' as `0x${string}`,
  paused: true,
  settlementPaused: true,
  nextJobId: 6n,
  completionReviewPeriod: 86400n,
  disputeReviewPeriod: 86400n,
  voteQuorum: 3n,
  requiredValidatorApprovals: 2n,
  requiredValidatorDisapprovals: 2n,
  withdrawableAGI: 1000n,
  lastSuccessfulBlock: 19031234n,
  degradedRpc: false
};
