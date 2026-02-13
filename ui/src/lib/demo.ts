'use client';
import { useEffect, useState } from 'react';
import { getScenario } from '@/demo/fixtures/scenarios';

export const isDemoMode = process.env.NEXT_PUBLIC_DEMO_MODE !== '0';

export function useDemoScenario() {
  const [key, setKey] = useState<string | undefined>(undefined);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setKey(params.get('scenario') ?? undefined);
  }, []);
  return getScenario(key);
}
