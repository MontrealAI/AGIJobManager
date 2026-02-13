export type DemoScenario = {
  id: string;
  title: string;
  summary: string;
  paused?: boolean;
  settlementPaused?: boolean;
  degraded?: boolean;
};

export const demoScenarios: DemoScenario[] = [
  { id: 'open', title: 'Open backlog', summary: 'Fresh jobs waiting for agents.' },
  { id: 'assigned', title: 'Assigned in progress', summary: 'Assigned jobs with active deadlines.' },
  { id: 'completion', title: 'Completion requested', summary: 'Validation/review windows active.' },
  { id: 'disputed', title: 'Disputed lane', summary: 'Moderator-required settlement.', settlementPaused: true },
  { id: 'settled', title: 'Settled portfolio', summary: 'Completed and NFT-issued jobs.' },
  { id: 'edge', title: 'Edge cases', summary: 'Deleted slots, malformed URI, huge values.', paused: true, degraded: true }
];

export function getScenario(id?: string) {
  return demoScenarios.find((scenario) => scenario.id === id) ?? demoScenarios[0];
}
