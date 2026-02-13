const ALLOWED_SCHEMES = ['https:', 'http:', 'ipfs:', 'ens:'] as const;

export function isAllowedUri(uri: string) {
  const clean = uri.trim().toLowerCase();
  if (!clean) return false;
  return ALLOWED_SCHEMES.some((scheme) => clean.startsWith(scheme));
}

export function toSafeHref(uri: string) {
  if (!isAllowedUri(uri)) return undefined;
  if (uri.startsWith('ipfs://')) return `https://ipfs.io/ipfs/${uri.replace('ipfs://', '')}`;
  if (uri.startsWith('ens://')) return `https://app.ens.domains/name/${uri.replace('ens://', '')}`;
  return uri;
}
