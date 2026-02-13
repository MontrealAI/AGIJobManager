export const errorMessages: Record<string, string> = {
  InvalidParameters: 'Invalid parameters',
  InvalidState: 'Action not allowed in current job state',
  NotAuthorized: 'Not authorized',
  SettlementPaused: 'Settlement paused',
  JobNotFound: 'Job not found'
}

export function humanizeError(name?: string) {
  if (!name) return 'Unknown error'
  return errorMessages[name] || name
}
