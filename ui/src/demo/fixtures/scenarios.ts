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
  specUri: string;
  completionUri: string;
};

export type DemoScenario = {
  key: string;
  title: string;
  paused: boolean;
  settlementPaused: boolean;
  degradedRpc: boolean;
  owner: `0x${string}`;
  nextJobId: bigint;
  completionReviewPeriod: bigint;
  disputeReviewPeriod: bigint;
  voteQuorum: bigint;
  requiredValidatorApprovals: bigint;
  requiredValidatorDisapprovals: bigint;
  withdrawableAGI: bigint;
  jobs: (DemoJob | null)[];
};

const Z = '0x0000000000000000000000000000000000000000' as const;

export const demoScenarios: DemoScenario[] = [
  {
    key: 'baseline',
    title: 'Baseline lifecycle coverage',
    paused: false,
    settlementPaused: false,
    degradedRpc: false,
    owner: '0x1111111111111111111111111111111111111111',
    nextJobId: 6n,
    completionReviewPeriod: 86400n,
    disputeReviewPeriod: 172800n,
    voteQuorum: 2n,
    requiredValidatorApprovals: 2n,
    requiredValidatorDisapprovals: 2n,
    withdrawableAGI: 1000000000000000000n,
    jobs: [
      { id: 0, employer:'0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', agent: Z, payout: 50000000000000000000n, duration: 86400n, assignedAt: 0n, completed:false, disputed:false, expired:false, completionRequested:false, completionRequestedAt:0n, disputedAt:0n, specUri:'https://example.com/spec/0', completionUri:'' },
      { id: 1, employer:'0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb', agent:'0xcccccccccccccccccccccccccccccccccccccccc', payout: 75000000000000000000n, duration: 172800n, assignedAt: 1700000000n, completed:false, disputed:false, expired:false, completionRequested:false, completionRequestedAt:0n, disputedAt:0n, specUri:'ipfs://QmAgentTask', completionUri:'' },
      { id: 2, employer:'0xdddddddddddddddddddddddddddddddddddddddd', agent:'0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee', payout: 40000000000000000000n, duration: 86400n, assignedAt: 1700000000n, completed:false, disputed:false, expired:false, completionRequested:true, completionRequestedAt:1700100000n, disputedAt:0n, specUri:'ens://jobs/2', completionUri:'https://example.com/completion/2' },
      { id: 3, employer:'0xffffffffffffffffffffffffffffffffffffffff', agent:'0x1212121212121212121212121212121212121212', payout: 99000000000000000000n, duration: 86400n, assignedAt: 1700000000n, completed:false, disputed:true, expired:false, completionRequested:true, completionRequestedAt:1700200000n, disputedAt:1700250000n, specUri:'javascript:alert(1)', completionUri:'data:text/plain,bad' },
      { id: 4, employer:'0x3434343434343434343434343434343434343434', agent:'0x4545454545454545454545454545454545454545', payout: 1000000000000000000000000000n, duration: 1n, assignedAt: 1700000000n, completed:true, disputed:false, expired:false, completionRequested:true, completionRequestedAt:1700000200n, disputedAt:0n, specUri:'http://example.org/huge', completionUri:'https://example.com/completion/4' },
      { id: 5, employer:'0x5656565656565656565656565656565656565656', agent:'0x6767676767676767676767676767676767676767', payout: 1200000000000000000n, duration: 10n, assignedAt: 1700000000n, completed:false, disputed:false, expired:true, completionRequested:false, completionRequestedAt:0n, disputedAt:0n, specUri:'file:///tmp/nope', completionUri:'' }
    ]
  },
  {
    key: 'degraded-paused',
    title: 'Degraded RPC + paused settlement',
    paused: true,
    settlementPaused: true,
    degradedRpc: true,
    owner: '0x1111111111111111111111111111111111111111',
    nextJobId: 3n,
    completionReviewPeriod: 400n,
    disputeReviewPeriod: 800n,
    voteQuorum: 3n,
    requiredValidatorApprovals: 2n,
    requiredValidatorDisapprovals: 2n,
    withdrawableAGI: 0n,
    jobs: [
      { id:0, employer:'0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', agent:Z, payout:1n,duration:1n,assignedAt:0n,completed:false,disputed:false,expired:false,completionRequested:false,completionRequestedAt:0n,disputedAt:0n,specUri:'https://example.com/ok',completionUri:'' },
      null,
      { id:2, employer:'0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb', agent:'0xcccccccccccccccccccccccccccccccccccccccc', payout:2n,duration:3n,assignedAt:1n,completed:false,disputed:false,expired:false,completionRequested:true,completionRequestedAt:3n,disputedAt:0n,specUri:'blob:https://bad',completionUri:'' }
    ]
  }
];

export function getScenario(key?: string) {
  return demoScenarios.find((s) => s.key === key) ?? demoScenarios[0];
}
