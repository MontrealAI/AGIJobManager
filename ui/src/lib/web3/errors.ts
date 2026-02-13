import { BaseError } from 'viem'

const map: Record<string, string> = {
  InvalidParameters: 'Invalid parameters',
  InvalidState: 'Action not allowed in current job state',
  NotAuthorized: 'Not authorized',
  SettlementPaused: 'Settlement paused',
  JobNotFound: 'Job not found'
}

export function decodeError(err?: BaseError | Error | null) {
  const msg = err?.message || ''
  const name = Object.keys(map).find((k) => msg.includes(k)) || 'UnknownError'
  return { name, human: map[name] || 'Unexpected error' }
}
