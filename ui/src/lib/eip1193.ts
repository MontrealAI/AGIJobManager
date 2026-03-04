export type Provider = { request: (args: { method: string; params?: unknown[] }) => Promise<unknown>; on?: (event: string, cb: (...args: unknown[]) => void) => void };

export async function discoverProviders(win: Window & typeof globalThis, timeoutMs = 20): Promise<Provider[]> {
  const providers: Provider[] = [];
  const listener = (event: Event) => {
    const detail = (event as CustomEvent<{ provider?: Provider }>).detail;
    if (detail?.provider) providers.push(detail.provider);
  };
  win.addEventListener('eip6963:announceProvider', listener as EventListener);
  win.dispatchEvent(new Event('eip6963:requestProvider'));
  await new Promise((resolve) => setTimeout(resolve, timeoutMs));
  win.removeEventListener('eip6963:announceProvider', listener as EventListener);
  const injected = (win as any).ethereum as Provider | undefined;
  if (injected) providers.push(injected);
  return providers;
}

export function attachProviderRefresh(provider: Provider, refresh: () => void) {
  if (!provider.on) return;
  provider.on('accountsChanged', refresh);
  provider.on('chainChanged', refresh);
  provider.on('disconnect', refresh);
}
