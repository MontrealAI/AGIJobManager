'use client';
import { useEffect, useMemo, useState } from 'react';
import { getScenario } from '@/demo/fixtures/scenarios';

export const isDemoMode = process.env.NEXT_PUBLIC_DEMO_MODE !== '0';

export type DemoActor = 'visitor' | 'employer' | 'agent' | 'validator' | 'moderator' | 'owner';
const ACTORS: DemoActor[] = ['visitor', 'employer', 'agent', 'validator', 'moderator', 'owner'];

function parseActor(input?: string | null): DemoActor {
  const lowered = (input ?? '').toLowerCase();
  return (ACTORS.find((a) => a === lowered) ?? (process.env.NEXT_PUBLIC_DEMO_ACTOR as DemoActor) ?? 'visitor');
}

export function useDemoScenario() {
  const [key, setKey] = useState<string | undefined>(undefined);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setKey(params.get('scenario') ?? undefined);
  }, []);
  return getScenario(key);
}

export function useDemoActor() {
  const [actor, setActor] = useState<DemoActor>(parseActor(undefined));

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setActor(parseActor(params.get('actor')));
  }, []);

  return actor;
}

export function useDemoRoleFlags() {
  const actor = useDemoActor();
  return useMemo(
    () => ({
      actor,
      isVisitor: actor === 'visitor',
      isEmployer: actor === 'employer',
      isAgent: actor === 'agent',
      isValidator: actor === 'validator',
      isModerator: actor === 'moderator',
      isOwner: actor === 'owner'
    }),
    [actor]
  );
}
