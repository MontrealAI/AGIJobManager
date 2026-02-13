import { SAFE_URI_SCHEMES } from './constants'

export function parseSafeUri(input: string) {
  try {
    const url = new URL(input.replace(/^ipfs:\/\//, 'https://ipfs.io/ipfs/'))
    return SAFE_URI_SCHEMES.includes(url.protocol as (typeof SAFE_URI_SCHEMES)[number])
  } catch {
    if (input.startsWith('ipfs://') || input.startsWith('ens://')) return true
    return false
  }
}
