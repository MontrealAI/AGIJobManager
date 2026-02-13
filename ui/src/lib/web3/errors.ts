export function decodeKnownErrorName(message: string) {
  const known = ['NotAuthorized', 'InvalidState', 'SettlementPaused', 'JobNotFound', 'Blacklisted'];
  const name = known.find((k) => message.includes(k));
  return name ?? 'UnknownError';
}

export function toUserFacingError(message: string) {
  const decoded = decodeKnownErrorName(message);
  if (decoded === 'NotAuthorized') return 'Not authorized for this action.';
  if (decoded === 'InvalidState') return 'Action blocked by current job state.';
  if (decoded === 'SettlementPaused') return 'Settlement is paused by governance.';
  if (decoded === 'JobNotFound') return 'Job not found (deleted slot or invalid id).';
  if (decoded === 'Blacklisted') return 'Address is blacklisted for this action.';
  return 'Transaction failed during simulation.';
}

export function decodeError(error: unknown) {
  const raw = String((error as { shortMessage?: string; message?: string } | undefined)?.shortMessage || (error as any)?.message || error || '');
  const name = decodeKnownErrorName(raw);
  return { name, human: toUserFacingError(raw) };
}

export const translateError = toUserFacingError;
