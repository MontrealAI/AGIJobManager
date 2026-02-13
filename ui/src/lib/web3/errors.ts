import type { BaseError } from 'viem';

const map: Record<string, string> = {
  InvalidParameters: 'Invalid parameters for this action.',
  InvalidState: 'Action not allowed in the current job state.',
  NotAuthorized: 'Your wallet does not have the required role.',
  SettlementPaused: 'Settlement is paused by operations policy.',
  Blacklisted: 'This address is blacklisted for safety.',
  JobNotFound: 'Job does not exist on-chain.',
  NotModerator: 'Only moderators can resolve disputes.'
};

export function translateError(errorName?: string) {
  if (!errorName) return 'Unknown error';
  return `${errorName}: ${map[errorName] || 'Transaction reverted.'}`;
}

function extractCustomErrorName(value?: string): string | undefined {
  if (!value) return undefined;
  const match = value.match(/(?:reverted with custom error|error)\s+([A-Za-z0-9_]+)/i);
  return match?.[1];
}

export function decodeError(error?: BaseError | Error | { name?: string; details?: string; shortMessage?: string }) {
  const name = extractCustomErrorName((error as any)?.details) || (error as any)?.name || 'Error';
  return {
    name,
    human: map[name] || (error as any)?.shortMessage || 'Transaction reverted'
  };
}
