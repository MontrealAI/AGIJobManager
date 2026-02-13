export type DemoJob = {
  id: number;
  core: {
    employer: `0x${string}`;
    assignedAgent: `0x${string}`;
    payout: bigint;
    duration: bigint;
    assignedAt: bigint;
    completed: boolean;
    disputed: boolean;
    expired: boolean;
  };
  validation: {
    completionRequested: boolean;
    approvals: bigint;
    disapprovals: bigint;
    completionRequestedAt: bigint;
    disputedAt: bigint;
  };
  specUri: string;
  completionUri: string;
  note: string;
};

export type DemoScenario = {
  id: string;
  title: string;
  owner: `0x${string}`;
  paused: boolean;
  settlementPaused: boolean;
  degradedRpc: boolean;
  completionReviewPeriod: bigint;
  disputeReviewPeriod: bigint;
  nextJobId: bigint;
  jobs: Array<DemoJob | null>;
};
