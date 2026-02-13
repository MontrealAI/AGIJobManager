export function isOwner(address?: string, owner?: string) {
  return !!address && !!owner && address.toLowerCase() === owner.toLowerCase()
}

export function canModerate(address?: string, isModerator?: boolean) {
  return !!address && !!isModerator
}
