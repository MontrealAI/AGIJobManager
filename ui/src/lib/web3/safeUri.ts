const allowedSchemes = ['https://', 'http://', 'ipfs://', 'ens://'] as const;
const blockedSchemes = ['javascript:', 'data:', 'file:', 'blob:'];

export function isAllowedUri(uri: string): boolean {
  const normalized = uri.trim().toLowerCase();
  if (!normalized) return false;
  if (blockedSchemes.some((scheme) => normalized.startsWith(scheme))) return false;
  return allowedSchemes.some((scheme) => normalized.startsWith(scheme));
}

export function sanitizeOutboundUri(uri: string): string | null {
  if (!isAllowedUri(uri)) return null;
  if (uri.startsWith('ipfs://')) return uri.replace('ipfs://', 'https://ipfs.io/ipfs/');
  if (uri.startsWith('ens://')) return `https://app.ens.domains/name/${uri.slice(6)}`;
  return uri;
}
