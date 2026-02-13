const blocked = ['javascript:', 'data:', 'file:', 'blob:'];
const allowed = ['https:', 'http:', 'ipfs:', 'ens:'];
export function isSafeUri(uri: string) {
  const lower = uri.trim().toLowerCase();
  if (blocked.some((p) => lower.startsWith(p))) return false;
  return allowed.some((p) => lower.startsWith(p));
}
