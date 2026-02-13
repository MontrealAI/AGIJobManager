const allow = new Set(['https:', 'http:', 'ipfs:', 'ens:']);
const block = new Set(['javascript:', 'data:', 'file:', 'blob:']);

export function sanitizeUri(uri: string): { safe: boolean; normalized?: string; reason?: string } {
  const raw = uri.trim();
  if (!raw) return { safe: false, reason: 'Empty URI' };
  const scheme = raw.includes(':') ? `${raw.split(':', 1)[0].toLowerCase()}:` : '';
  if (!scheme || block.has(scheme) || !allow.has(scheme)) return { safe: false, reason: `Blocked scheme: ${scheme || 'none'}` };
  if (scheme === 'ipfs:') return { safe: true, normalized: raw.replace(/^ipfs:\/\//i, 'https://ipfs.io/ipfs/') };
  if (scheme === 'ens:') return { safe: true, normalized: `https://app.ens.domains/name/${raw.replace(/^ens:\/\//i, '')}` };
  return { safe: true, normalized: raw };
}

export function isAllowedUri(uri: string) {
  return sanitizeUri(uri).safe;
}
