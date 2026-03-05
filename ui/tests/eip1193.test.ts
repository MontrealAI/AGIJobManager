import { describe, expect, it, vi } from 'vitest';
import { attachProviderRefresh, discoverProviders } from '@/lib/eip1193';

describe('EIP-1193 helpers', () => {
  it('discovers EIP-6963 and injected providers', async () => {
    const p1 = { request: vi.fn() };
    const p2 = { request: vi.fn() };
    (window as any).ethereum = p2;
    window.addEventListener('eip6963:requestProvider', () => {
      window.dispatchEvent(new CustomEvent('eip6963:announceProvider', { detail: { provider: p1 } }));
    }, { once: true });
    const providers = await discoverProviders(window, 0);
    expect(providers).toContain(p1);
    expect(providers).toContain(p2);
  });

  it('binds refresh callbacks for wallet events', () => {
    const on = vi.fn();
    const refresh = vi.fn();
    attachProviderRefresh({ request: vi.fn(), on }, refresh);
    expect(on).toHaveBeenCalledWith('accountsChanged', refresh);
    expect(on).toHaveBeenCalledWith('chainChanged', refresh);
    expect(on).toHaveBeenCalledWith('disconnect', refresh);
  });
});
