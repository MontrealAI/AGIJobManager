const ALLOWED_SCHEMES = ['https:', 'http:', 'ipfs:', 'ens:'];

export function isAllowedUri(raw: string): boolean {
  const value = raw.trim();
  if (!value) return false;
  return ALLOWED_SCHEMES.some((scheme) => value.toLowerCase().startsWith(scheme));
}

export function sanitizeUri(raw: string): { safe: boolean; reason?: string } {
  if (!isAllowedUri(raw)) return { safe: false, reason: 'Scheme blocked' };
  try {
    if (raw.startsWith('https://') || raw.startsWith('http://')) {
      const url = new URL(raw);
      if (!url.hostname) return { safe: false, reason: 'Missing hostname' };
    }
    return { safe: true };
  } catch {
    return { safe: false, reason: 'Malformed URL' };
  }
}
