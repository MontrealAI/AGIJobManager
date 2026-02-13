const ALLOWED_SCHEMES = ['https:', 'http:', 'ipfs:', 'ens:'];
const BLOCKED_SCHEMES = ['javascript:', 'data:', 'file:', 'blob:'];

export function isAllowedUri(uri: string) {
  const input = String(uri || '').trim().toLowerCase();
  if (!input) return false;
  if (BLOCKED_SCHEMES.some((s) => input.startsWith(s))) return false;
  return ALLOWED_SCHEMES.some((s) => input.startsWith(s));
}

export function toSafeHref(uri: string) {
  if (!isAllowedUri(uri)) return null;
  if (uri.startsWith('ipfs://')) return `https://ipfs.io/ipfs/${uri.replace('ipfs://', '')}`;
  if (uri.startsWith('ens://')) return `https://app.ens.domains/${uri.replace('ens://', '')}`;
  return uri;
}
