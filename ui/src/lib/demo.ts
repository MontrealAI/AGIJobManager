import { getScenario } from '@/demo/fixtures/scenarios';

export const isDemoMode = process.env.NEXT_PUBLIC_DEMO_MODE === '1';

export function currentScenario(search?: string) {
  const params = new URLSearchParams(search);
  return getScenario(params.get('scenario') ?? undefined);
}

export function toCsv(rows: Array<Record<string, string | number>>) {
  if (!rows.length) return '';
  const keys = Object.keys(rows[0]);
  const escape = (v: string | number) => `"${String(v).replaceAll('"', '""')}"`;
  return [keys.join(','), ...rows.map((r) => keys.map((k) => escape(r[k])).join(','))].join('\n');
}
