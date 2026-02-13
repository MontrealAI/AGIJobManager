import type { BaseError } from 'viem';

const map: Record<string, string> = {
  InvalidParameters: 'Invalid parameters',
  InvalidState: 'Action not allowed in current job state',
  NotAuthorized: 'Not authorized',
  SettlementPaused: 'Settlement paused',
  Blacklisted: 'Address is blacklisted',
  JobNotFound: 'Job not found',
  NotModerator: 'Only moderator allowed'
};

export function translateError(errorName?: string) {
  return errorName ? `${errorName}: ${map[errorName] || 'Transaction reverted'}` : 'Unknown error';
}

export function decodeError(error?: BaseError) {
  const name = ((error as any)?.name as string) || 'Error';
  return { name, human: map[name] || error?.shortMessage || 'Transaction reverted' };
}
