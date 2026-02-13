const allowedSchemes = ['https://', 'http://', 'ipfs://', 'ens://']

export function isSafeUri(uri: string) {
  const value = uri.trim().toLowerCase()
  return allowedSchemes.some((scheme) => value.startsWith(scheme))
}
