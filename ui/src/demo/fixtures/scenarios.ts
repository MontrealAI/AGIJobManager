import rawScenarios from './scenarios.json';

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

type RawDemoJob = Omit<DemoJob, 'payout' | 'duration' | 'assignedAt' | 'completionRequestedAt' | 'disputedAt'> & {
  payout: string;
  duration: string;
  assignedAt: string;
  completionRequestedAt: string;
  disputedAt: string;
};

type RawScenario = Omit<DemoScenario, 'nextJobId' | 'completionReviewPeriod' | 'disputeReviewPeriod' | 'voteQuorum' | 'requiredValidatorApprovals' | 'requiredValidatorDisapprovals' | 'withdrawableAGI' | 'jobs'> & {
  nextJobId: string;
  completionReviewPeriod: string;
  disputeReviewPeriod: string;
  voteQuorum: string;
  requiredValidatorApprovals: string;
  requiredValidatorDisapprovals: string;
  withdrawableAGI: string;
  jobs: (RawDemoJob | null)[];
};

const toBigInt = (value: string) => BigInt(value);

const normalizeJob = (job: RawDemoJob): DemoJob => ({
  ...job,
  payout: toBigInt(job.payout),
  duration: toBigInt(job.duration),
  assignedAt: toBigInt(job.assignedAt),
  completionRequestedAt: toBigInt(job.completionRequestedAt),
  disputedAt: toBigInt(job.disputedAt)
});

export const demoScenarios: DemoScenario[] = (rawScenarios as RawScenario[]).map((scenario) => ({
  ...scenario,
  nextJobId: toBigInt(scenario.nextJobId),
  completionReviewPeriod: toBigInt(scenario.completionReviewPeriod),
  disputeReviewPeriod: toBigInt(scenario.disputeReviewPeriod),
  voteQuorum: toBigInt(scenario.voteQuorum),
  requiredValidatorApprovals: toBigInt(scenario.requiredValidatorApprovals),
  requiredValidatorDisapprovals: toBigInt(scenario.requiredValidatorDisapprovals),
  withdrawableAGI: toBigInt(scenario.withdrawableAGI),
  jobs: scenario.jobs.map((job) => (job ? normalizeJob(job) : null))
}));

export function getScenario(key?: string) {
  return demoScenarios.find((s) => s.key === key) ?? demoScenarios[0];
}
