'use client';
import { useEffect, useState } from 'react';
import { getScenario } from '@/demo/fixtures/scenarios';

export const isDemoMode = process.env.NEXT_PUBLIC_DEMO_MODE !== '0';
export const defaultDemoActor = (process.env.NEXT_PUBLIC_DEMO_ACTOR ?? 'visitor') as 'visitor'|'employer'|'agent'|'validator'|'moderator'|'owner';

export function useDemoScenario() {
  const [key, setKey] = useState<string | undefined>(undefined);
  const [actor, setActor] = useState(defaultDemoActor);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setKey(params.get('scenario') ?? undefined);
    setActor((params.get('actor') as typeof actor) ?? defaultDemoActor);
  }, []);

  return { scenario: getScenario(key), actor };
}
