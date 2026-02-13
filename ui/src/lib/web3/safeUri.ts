const ALLOWED_SCHEMES = ['https:', 'http:', 'ipfs:', 'ens:'] as const;

export function sanitizeUri(uri: string): { safe: boolean; href?: string; reason?: string } {
  if (!uri || typeof uri !== 'string') return { safe: false, reason: 'Empty URI' };
  const trimmed = uri.trim();
  const lower = trimmed.toLowerCase();
  if (['javascript:', 'data:', 'file:', 'blob:'].some((s) => lower.startsWith(s))) {
    return { safe: false, reason: 'Blocked scheme' };
  }
  if (!ALLOWED_SCHEMES.some((s) => lower.startsWith(s))) return { safe: false, reason: 'Scheme not allowlisted' };
  if (lower.startsWith('ipfs://')) {
    return { safe: true, href: `https://ipfs.io/ipfs/${trimmed.slice('ipfs://'.length)}` };
  }
  if (lower.startsWith('ens://')) {
    return { safe: true, href: `https://app.ens.domains/name/${trimmed.slice('ens://'.length)}` };
  }
  try {
    const parsed = new URL(trimmed);
    return { safe: parsed.protocol === 'https:' || parsed.protocol === 'http:', href: parsed.toString() };
  } catch {
    return { safe: false, reason: 'Malformed URI' };
  }
}

export function isAllowedUri(uri: string) {
  return sanitizeUri(uri).safe;
}
