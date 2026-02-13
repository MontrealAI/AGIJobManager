const allowed = ['https:', 'http:', 'ipfs:', 'ens:'];
export function isAllowedUri(uri: string){
  try { const u = new URL(uri.replace('ipfs://','https://ipfs.io/ipfs/').replace('ens://','https://ens.domains/')); return allowed.some(s=>uri.startsWith(s)); } catch { return false; }
}
