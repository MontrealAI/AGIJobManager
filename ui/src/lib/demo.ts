import { getScenario } from '@/demo/fixtures/scenarios';

export const isDemoMode = process.env.NEXT_PUBLIC_DEMO_MODE === '1';

export function scenarioFromSearch(search?: string) {
  const params = new URLSearchParams(search || '');
  return getScenario(params.get('scenario') || undefined);
}
