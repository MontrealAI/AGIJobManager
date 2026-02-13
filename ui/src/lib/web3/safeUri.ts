const ALLOWLIST = ['https://', 'http://', 'ipfs://', 'ens://'] as const;

export function isAllowedUri(uri: string) {
  if (!uri) return false;
  const trimmed = uri.trim();
  return ALLOWLIST.some((prefix) => trimmed.toLowerCase().startsWith(prefix));
}

export function toSafeHref(uri: string) {
  if (!isAllowedUri(uri)) return null;
  if (uri.startsWith('ipfs://')) return `https://ipfs.io/ipfs/${uri.replace('ipfs://', '')}`;
  if (uri.startsWith('ens://')) return `https://app.ens.domains/name/${uri.replace('ens://', '')}`;
  return uri;
}
