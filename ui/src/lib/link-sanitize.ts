export function toSafeLink(raw: string, allowHttp = false): string | null {
  const value = String(raw || '').trim();
  if (!value) return null;
  const lower = value.toLowerCase();
  if (lower.startsWith('https://') || lower.startsWith('ipfs://') || lower.startsWith('ens://')) return value;
  if (allowHttp && lower.startsWith('http://')) return value;
  return null;
}
