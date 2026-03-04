import { describe, expect, it, vi } from 'vitest';

describe('demo mode defaults', () => {
  it('defaults to live mode when NEXT_PUBLIC_DEMO_MODE is unset', async () => {
    vi.unstubAllEnvs();
    vi.resetModules();
    vi.stubEnv('NEXT_PUBLIC_DEMO_MODE', undefined);
    const mod = await import('@/lib/demo');
    expect(mod.isDemoMode).toBe(false);
  });

  it('enables demo mode only for explicit NEXT_PUBLIC_DEMO_MODE=1', async () => {
    vi.unstubAllEnvs();
    vi.resetModules();
    vi.stubEnv('NEXT_PUBLIC_DEMO_MODE', '1');
    const mod = await import('@/lib/demo');
    expect(mod.isDemoMode).toBe(true);
  });
});
