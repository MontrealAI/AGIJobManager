const ALLOWED = ['https:', 'http:', 'ipfs:', 'ens:'] as const;
const BLOCKED = ['javascript:', 'data:', 'file:', 'blob:'] as const;

export function sanitizeUri(uri: string): string {
  const trimmed = uri.trim();
  if (!trimmed) return '';
  const lower = trimmed.toLowerCase();
  if (BLOCKED.some((scheme) => lower.startsWith(scheme))) return '';
  if (lower.startsWith('ipfs://') || lower.startsWith('ens://')) return trimmed;

  try {
    const parsed = new URL(trimmed);
    return ALLOWED.includes(parsed.protocol as (typeof ALLOWED)[number]) ? trimmed : '';
  } catch {
    return '';
  }
}

export function isAllowedUri(uri: string) {
  return sanitizeUri(uri).length > 0;
}
