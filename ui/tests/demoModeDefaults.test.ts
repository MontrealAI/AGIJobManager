import { describe, expect, it, vi } from 'vitest';

async function readDemoModeWithEnv(value: string | undefined) {
  vi.resetModules();
  vi.unstubAllEnvs();
  if (value === undefined) {
    delete process.env.NEXT_PUBLIC_DEMO_MODE;
  } else {
    vi.stubEnv('NEXT_PUBLIC_DEMO_MODE', value);
  }
  const mod = await import('../src/lib/demo');
  return mod.isDemoMode;
}

describe('demo mode defaults', () => {
  it('defaults to live mode when NEXT_PUBLIC_DEMO_MODE is unset', async () => {
    await expect(readDemoModeWithEnv(undefined)).resolves.toBe(false);
  });

  it('enables demo mode only when NEXT_PUBLIC_DEMO_MODE=1', async () => {
    await expect(readDemoModeWithEnv('1')).resolves.toBe(true);
    await expect(readDemoModeWithEnv('0')).resolves.toBe(false);
  });
});
