import { Transaction } from 'ethers';
import { GateError, validateIntent } from './envelope.mjs';

const fields = ['format', 'status', 'signedAt', 'transactionHash', 'unsignedTransaction', 'expectedUnsignedHash', 'expectedPolicyHash', 'review', 'signedTransaction'];
const fail = code => { throw new GateError(code); };
export function coordinatorImport(prepared, capability, now = Date.now()) {
  if (!prepared || typeof prepared !== 'object') fail('INDEPENDENT_REVIEW_REQUIRED');
  const current = validateIntent(prepared.unsignedHex, prepared.expectedUnsignedHash, prepared.review, prepared.expectedPolicyHash, now, { allowExpired: true });
  if (!capability || typeof capability !== 'object' || Array.isArray(capability) || Object.keys(capability).sort().join('|') !== [...fields].sort().join('|') || capability.format !== 'mainnet-ledger-signed-capability-v1') fail('INVALID_SIGNED_CAPABILITY');
  if (!['SIGNED_NOT_SUBMITTED', 'EXPIRED_SIGNED_CAPABILITY_DO_NOT_RELAY'].includes(capability.status)) fail('INVALID_CAPABILITY_STATUS');
  const supplied = validateIntent(capability.unsignedTransaction, capability.expectedUnsignedHash, capability.review, capability.expectedPolicyHash, now, { allowExpired: true });
  if (supplied.unsignedHex !== current.unsignedHex || supplied.expectedUnsignedHash !== current.expectedUnsignedHash || supplied.expectedPolicyHash !== current.expectedPolicyHash) fail('CAPABILITY_REVIEW_MISMATCH');
  const signedAt = Date.parse(capability.signedAt);
  if (typeof capability.signedAt !== 'string' || !Number.isFinite(signedAt) || new Date(signedAt).toISOString() !== capability.signedAt) fail('INVALID_CAPABILITY_TIME');
  if (typeof capability.signedTransaction !== 'string' || !/^0x(?:[0-9a-f]{2})+$/.test(capability.signedTransaction) || capability.signedTransaction.length > 262338) fail('INVALID_SIGNED_BYTES');
  let signed;
  try {
    signed = Transaction.from(capability.signedTransaction);
    if (!signed.signature || signed.serialized !== capability.signedTransaction) fail('INVALID_SIGNED_BYTES');
    if (signed.type !== 2 || signed.unsignedSerialized !== current.unsignedHex || signed.unsignedHash !== current.expectedUnsignedHash) fail('SIGNED_ENVELOPE_MISMATCH');
    if (signed.from !== current.sender) fail('SIGNER_MISMATCH');
    if (signed.hash !== capability.transactionHash) fail('SIGNED_HASH_MISMATCH');
  } catch (error) { if (error instanceof GateError) throw error; fail('INVALID_SIGNED_BYTES'); }
  if (current.expired || signedAt >= current.expiry || capability.status === 'EXPIRED_SIGNED_CAPABILITY_DO_NOT_RELAY') fail('COORDINATOR_IMPORT_EXPIRED_DO_NOT_RELAY');
  if (signedAt > now) fail('INVALID_CAPABILITY_TIME');
  return Object.freeze({ raw: signed.serialized });
}
