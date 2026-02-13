const map: Record<string, string> = {
  InvalidParameters: 'Invalid parameters.',
  InvalidState: 'Action not allowed in current job state.',
  NotAuthorized: 'Address lacks required role.',
  SettlementPaused: 'Settlement lane is paused.',
  Blacklisted: 'Address is blacklisted by policy.',
  JobNotFound: 'Job slot is deleted or unknown.',
  NotModerator: 'Only moderator may resolve this dispute.'
};

export function mapErrorName(name?: string) {
  if (!name) return 'Unknown contract error.';
  return map[name] ?? `${name}: transaction reverted`;
}

export function translateError(name?: string) {
  return mapErrorName(name);
}

export function decodeError(error?: { name?: string; shortMessage?: string }) {
  const name = error?.name || 'Unknown';
  return { name, human: map[name] || error?.shortMessage || 'Transaction reverted' };
}
