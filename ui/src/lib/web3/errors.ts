import type { BaseError } from 'viem';

const map: Record<string, string> = {
  InvalidParameters: 'Invalid parameters.',
  InvalidState: 'Action not allowed in current job state.',
  NotAuthorized: 'Connected wallet lacks required role.',
  SettlementPaused: 'Settlement is paused by owner policy.',
  Blacklisted: 'Address is blacklisted in policy.',
  JobNotFound: 'Job slot was deleted or never existed.',
  NotModerator: 'Only moderators can resolve this dispute.'
};

export function decodeError(error?: BaseError | Error | unknown) {
  const raw = String((error as any)?.shortMessage ?? (error as any)?.message ?? 'Unknown error');
  const found = Object.keys(map).find((k) => raw.includes(k)) || (error as any)?.name;
  return { name: found ?? 'Unknown', human: map[found ?? ''] ?? raw };
}

export function translateError(errorName?: string) {
  const name = errorName ?? 'Unknown';
  return `${name}: ${map[name] ?? 'Transaction reverted.'}`;
}
