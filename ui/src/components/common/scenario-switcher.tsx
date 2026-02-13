'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { scenarios } from '@/demo/fixtures/scenarios';

export function ScenarioSwitcher() {
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();
  const current = search.get('scenario') ?? 'default';

  return (
    <label className="text-xs text-muted-foreground flex items-center gap-2">
      Scenario
      <select
        className="bg-card border border-border rounded-md px-2 py-1 text-foreground"
        value={current}
        onChange={(event) => {
          const q = new URLSearchParams(search.toString());
          q.set('scenario', event.target.value);
          router.push(`${pathname}?${q.toString()}`);
        }}
      >
        {scenarios.map((scenario) => (
          <option value={scenario.id} key={scenario.id}>
            {scenario.id}
          </option>
        ))}
      </select>
    </label>
  );
}
