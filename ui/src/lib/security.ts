const allowed = ['https:', 'http:', 'ipfs:', 'ens:']
export function isSafeUri(uri: string) {
  try {
    const p = new URL(uri)
    return allowed.includes(p.protocol)
  } catch {
    if (uri.startsWith('ipfs://') || uri.startsWith('ens://')) return true
    return false
  }
}
