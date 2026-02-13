const allowedSchemes = ['https://', 'http://', 'ipfs://', 'ens://']

export function isSafeUri(uri: string) {
  const value = uri.trim().toLowerCase()
  if (!value) return false
  return allowedSchemes.some((scheme) => value.startsWith(scheme))
}
