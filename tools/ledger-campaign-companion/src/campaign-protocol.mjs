import { GateError, validateIntent } from './envelope.mjs';

export const CHANNEL_FORMAT = 'mainnet-ledger-campaign-channel-v1';
export const MAX_CHANNEL_BYTES = 400 * 1024;
export const STATES = Object.freeze(['awaiting-owner-approval','signed','submitted','pending','finalized','verified','blocked','recovery-required']);
const fail = code => { throw new GateError(code); };
export function isLoopbackOrigin(origin) {
  try { const u = new URL(origin); return u.protocol === 'http:' && u.hostname === '127.0.0.1' && /^\d+$/.test(u.port) && Number(u.port) >= 1024 && u.origin === origin; } catch { return false; }
}
export function bounded(value) {
  let encoded; try { encoded = JSON.stringify(value); } catch { fail('CHANNEL_MESSAGE_REJECTED'); }
  if (typeof encoded !== 'string' || new TextEncoder().encode(encoded).byteLength > MAX_CHANNEL_BYTES) fail('CHANNEL_MESSAGE_REJECTED');
  return value;
}
export function channelNonce(value) {
  if (typeof value !== 'string' || !/^[a-f0-9]{64}$/.test(value)) fail('CHANNEL_NONCE_REJECTED');
  return value;
}
export function validatePreparedPacket(value, now = Date.now()) {
  bounded(value);
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).sort().join('|') !== ['expectedPolicyHash','expectedUnsignedHash','review','unsignedHex'].sort().join('|')) fail('PREPARED_PACKET_REJECTED');
  const prepared = validateIntent(value.unsignedHex, value.expectedUnsignedHash, value.review, value.expectedPolicyHash, now);
  // Reserve the bounded full private capability (unsigned + signed bytes) before any device access.
  if (2 * prepared.unsignedHex.length + new TextEncoder().encode(JSON.stringify(prepared.review)).byteLength + 4096 > MAX_CHANNEL_BYTES) fail('PREPARED_PACKET_EXCEEDS_PRIVATE_HANDOFF_BOUND');
  return prepared;
}
export function requireMessage(value, nonce, allowed) {
  bounded(value);
  if (!value || typeof value !== 'object' || Array.isArray(value) || value.format !== CHANNEL_FORMAT || value.nonce !== channelNonce(nonce) || !allowed.includes(value.type)) fail('CHANNEL_MESSAGE_REJECTED');
  const keySets = { prepare: ['prepared'], durable: ['identity','transactionHash'], cancel: [], block: ['code'], advance: ['identity','verified'], ready: [], prepared: ['identity'], signing: ['identity'], signed: ['identity','capability','importAvailable'], recovery: ['identity','code'] };
  const optionalFormat = value.type === 'prepare' && Object.hasOwn(value, 'importFormat');
  if (optionalFormat && value.importFormat !== null && !['manager-json', 'alpha-raw'].includes(value.importFormat)) fail('CHANNEL_MESSAGE_REJECTED');
  const expected = ['format','nonce','type', ...(keySets[value.type] ?? []), ...(optionalFormat ? ['importFormat'] : [])].sort().join('|');
  if (Object.keys(value).sort().join('|') !== expected) fail('CHANNEL_MESSAGE_REJECTED');
  return value;
}
export function preparedIdentity(prepared) {
  return Object.freeze({ operationId: prepared.review.operationId, expectedUnsignedHash: prepared.expectedUnsignedHash, expectedPolicyHash: prepared.expectedPolicyHash });
}
export function sameIdentity(a, b) {
  return Boolean(a && b && a.operationId === b.operationId && a.expectedUnsignedHash === b.expectedUnsignedHash && a.expectedPolicyHash === b.expectedPolicyHash);
}
export function safeCode(error, fallback = 'OPERATION_STOPPED_RECOVERY_REQUIRED') {
  return error instanceof GateError && /^[A-Z][A-Z0-9_]{0,95}$/.test(error.code) ? error.code : fallback;
}
