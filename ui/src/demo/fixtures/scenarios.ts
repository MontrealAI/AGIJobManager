import type { DemoScenario } from '@/demo/types';

const A0 = '0x0000000000000000000000000000000000000000' as const;
const EMP = '0x1000000000000000000000000000000000000001' as const;
const AGT = '0x2000000000000000000000000000000000000002' as const;
const OWN = '0x3000000000000000000000000000000000000003' as const;

export const scenarios: DemoScenario[] = [
  {
    id: 'default',
    title: 'Balanced lifecycle coverage',
    owner: OWN,
    paused: false,
    settlementPaused: false,
    degradedRpc: false,
    completionReviewPeriod: 86400n,
    disputeReviewPeriod: 172800n,
    nextJobId: 6n,
    jobs: [
      { id: 0, note: 'Open', core: { employer: EMP, assignedAgent: A0, payout: 1200n * 10n ** 18n, duration: 3600n, assignedAt: 0n, completed: false, disputed: false, expired: false }, validation: { completionRequested: false, approvals: 0n, disapprovals: 0n, completionRequestedAt: 0n, disputedAt: 0n }, specUri: 'https://example.org/spec/0', completionUri: '' },
      { id: 1, note: 'Assigned', core: { employer: EMP, assignedAgent: AGT, payout: 33n * 10n ** 18n, duration: 7200n, assignedAt: 1700000000n, completed: false, disputed: false, expired: false }, validation: { completionRequested: false, approvals: 0n, disapprovals: 0n, completionRequestedAt: 0n, disputedAt: 0n }, specUri: 'ipfs://bafybeigdemoassigned', completionUri: '' },
      { id: 2, note: 'Completion requested', core: { employer: EMP, assignedAgent: AGT, payout: 42n * 10n ** 18n, duration: 9000n, assignedAt: 1700000300n, completed: false, disputed: false, expired: false }, validation: { completionRequested: true, approvals: 2n, disapprovals: 0n, completionRequestedAt: 1700008300n, disputedAt: 0n }, specUri: 'ens://job2', completionUri: 'https://example.org/completion/2' },
      { id: 3, note: 'Disputed with malformed uri', core: { employer: EMP, assignedAgent: AGT, payout: 2n ** 120n, duration: 1200n, assignedAt: 1700010300n, completed: false, disputed: true, expired: false }, validation: { completionRequested: true, approvals: 1n, disapprovals: 1n, completionRequestedAt: 1700011300n, disputedAt: 1700015300n }, specUri: 'javascript:alert(1)', completionUri: 'data:text/html,<h1>x</h1>' },
      { id: 4, note: 'Settled tie votes', core: { employer: EMP, assignedAgent: AGT, payout: 85n * 10n ** 18n, duration: 5000n, assignedAt: 1699900000n, completed: true, disputed: false, expired: false }, validation: { completionRequested: true, approvals: 2n, disapprovals: 2n, completionRequestedAt: 1699910000n, disputedAt: 0n }, specUri: 'https://example.org/spec/4', completionUri: 'ipfs://bafybei-complete-4' },
      { id: 5, note: 'Expired no-vote liveness', core: { employer: EMP, assignedAgent: AGT, payout: 12n * 10n ** 18n, duration: 30n, assignedAt: 1600000000n, completed: false, disputed: false, expired: true }, validation: { completionRequested: false, approvals: 0n, disapprovals: 0n, completionRequestedAt: 0n, disputedAt: 0n }, specUri: 'file:///tmp/blocked', completionUri: '' }
    ]
  },
  {
    id: 'ops-incident',
    title: 'Paused + settlement pause + degraded rpc',
    owner: OWN,
    paused: true,
    settlementPaused: true,
    degradedRpc: true,
    completionReviewPeriod: 86400n,
    disputeReviewPeriod: 172800n,
    nextJobId: 3n,
    jobs: [
      { id: 0, note: 'Open under pause', core: { employer: EMP, assignedAgent: A0, payout: 1n, duration: 1n, assignedAt: 0n, completed: false, disputed: false, expired: false }, validation: { completionRequested: false, approvals: 0n, disapprovals: 0n, completionRequestedAt: 0n, disputedAt: 0n }, specUri: 'https://example.org/spec/ops0', completionUri: '' },
      null,
      { id: 2, note: 'Deleted slot simulation', core: { employer: EMP, assignedAgent: AGT, payout: 50n, duration: 1n, assignedAt: 1700000000n, completed: false, disputed: true, expired: false }, validation: { completionRequested: true, approvals: 0n, disapprovals: 0n, completionRequestedAt: 1700000020n, disputedAt: 1700000030n }, specUri: 'https://example.org/spec/ops2', completionUri: 'https://example.org/completion/ops2' }
    ]
  }
];

export function getScenario(id?: string) {
  return scenarios.find((s) => s.id === id) ?? scenarios[0];
}
