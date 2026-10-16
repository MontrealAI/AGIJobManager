import { Transaction, Signature, getAddress, keccak256, toUtf8Bytes } from 'ethers';

export class GateError extends Error {
  constructor(code) { super(code); this.code = code; }
}
const fail = code => { throw new GateError(code); };
const keys = ['chainId', 'expectedSender', 'expiresAt', 'maxGasLimit', 'maxFeePerGas', 'maxPriorityFeePerGas', 'maxTotalFeeWei', 'maxValueWei', 'operationId', 'sourceSha256'];
export const MAINNET_TRANSACTION_GAS_CAP = 16777216n;
export function policyDigest(review, expectedUnsignedHash) {
  if (typeof expectedUnsignedHash !== 'string' || !/^0x[0-9a-fA-F]{64}$/.test(expectedUnsignedHash)) fail('INVALID_INDEPENDENT_HASH');
  const envelope = { domain: 'mainnet-ledger-reviewed-intent-v1', unsignedHash: expectedUnsignedHash.toLowerCase(), policy: Object.fromEntries([...keys].sort().map(key => [key, review[key]])) };
  return keccak256(toUtf8Bytes(JSON.stringify(envelope)));
}
function uint(value, name) {
  if (typeof value !== 'string' || !/^(0|[1-9][0-9]*)$/.test(value) || value.length > 78) fail(`INVALID_${name}`);
  const n = BigInt(value);
  if (n >= 1n << 256n) fail(`INVALID_${name}`);
  return n;
}
function address(value) {
  try { return getAddress(value); } catch { fail('INVALID_EXPECTED_SENDER'); }
}
export function validateIntent(unsignedHex, expectedUnsignedHash, review, expectedPolicyHash, now = Date.now(), { allowExpired = false } = {}) {
  if (!Number.isFinite(now) || typeof review !== 'object' || review === null || Array.isArray(review)) fail('INVALID_REVIEW');
  if (Object.keys(review).sort().join('|') !== [...keys].sort().join('|')) fail('INVALID_REVIEW_FIELDS');
  if (typeof expectedPolicyHash !== 'string' || !/^0x[0-9a-fA-F]{64}$/.test(expectedPolicyHash)) fail('INVALID_INDEPENDENT_POLICY_HASH');
  if (policyDigest(review, expectedUnsignedHash) !== expectedPolicyHash.toLowerCase()) fail('POLICY_HASH_MISMATCH');
  if (review.chainId !== '1') fail('CHAIN_MUST_BE_MAINNET');
  if (!/^[A-Za-z0-9][A-Za-z0-9_.-]{0,95}$/.test(review.operationId ?? '')) fail('INVALID_OPERATION_ID');
  if (!/^0x[0-9a-fA-F]{64}$/.test(review.sourceSha256 ?? '')) fail('INVALID_SOURCE_HASH');
  if (typeof review.expiresAt !== 'string' || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,3})?Z$/.test(review.expiresAt)) fail('INVALID_EXPIRY');
  const expiry = Date.parse(review.expiresAt);
  if (!Number.isFinite(expiry) || new Date(expiry).toISOString().slice(0, 19) !== review.expiresAt.slice(0, 19)) fail('INVALID_EXPIRY');
  const expired = now >= expiry;
  if (expired && !allowExpired) fail('INTENT_EXPIRED');
  const sender = address(review.expectedSender);
  if (sender === '0x0000000000000000000000000000000000000000') fail('ZERO_SENDER');
  if (typeof unsignedHex !== 'string' || !/^0x(?:[0-9a-fA-F]{2})+$/.test(unsignedHex) || unsignedHex.length > 262146) fail('INVALID_UNSIGNED_BYTES');
  if (typeof expectedUnsignedHash !== 'string' || !/^0x[0-9a-fA-F]{64}$/.test(expectedUnsignedHash)) fail('INVALID_INDEPENDENT_HASH');
  const raw = unsignedHex.toLowerCase();
  if (keccak256(raw) !== expectedUnsignedHash.toLowerCase()) fail('UNSIGNED_HASH_MISMATCH');
  let tx;
  try { tx = Transaction.from(raw); } catch { fail('INVALID_TRANSACTION'); }
  if (tx.type !== 2) fail('TYPE_2_REQUIRED');
  if (tx.chainId !== 1n) fail('TRANSACTION_CHAIN_MISMATCH');
  if (tx.signature !== null) fail('INPUT_ALREADY_SIGNED');
  if (tx.authorizationList !== null || tx.blobs !== null || tx.blobVersionedHashes !== null) fail('UNSUPPORTED_EXECUTION_MODE');
  if (tx.unsignedSerialized !== raw) fail('NONCANONICAL_UNSIGNED_BYTES');
  if (!Number.isSafeInteger(tx.nonce) || tx.nonce < 0) fail('INVALID_NONCE');
  if (tx.to === '0x0000000000000000000000000000000000000000') fail('ZERO_DESTINATION_IS_NOT_CREATE');
  if (tx.data === '0x') fail('DEPLOYMENT_OR_GOVERNOR_CALL_REQUIRED');
  if (tx.to === null && (tx.data.length - 2) / 2 > 49152) fail('INITCODE_TOO_LARGE');
  const gasCeiling = uint(review.maxGasLimit, 'GAS_CEILING');
  const feeCeiling = uint(review.maxFeePerGas, 'FEE_CEILING');
  const priorityCeiling = uint(review.maxPriorityFeePerGas, 'PRIORITY_CEILING');
  const totalCeiling = uint(review.maxTotalFeeWei, 'TOTAL_FEE_CEILING');
  const valueCeiling = uint(review.maxValueWei, 'VALUE_CEILING');
  if (tx.gasLimit > MAINNET_TRANSACTION_GAS_CAP) fail('MAINNET_TRANSACTION_GAS_CAP_EXCEEDED');
  if (tx.gasLimit <= 0n || tx.gasLimit > gasCeiling) fail('GAS_LIMIT_EXCEEDS_REVIEW');
  if (tx.maxFeePerGas === null || tx.maxFeePerGas <= 0n || tx.maxFeePerGas > feeCeiling) fail('FEE_EXCEEDS_REVIEW');
  if (tx.maxPriorityFeePerGas === null || tx.maxPriorityFeePerGas > priorityCeiling || tx.maxPriorityFeePerGas > tx.maxFeePerGas) fail('PRIORITY_EXCEEDS_REVIEW');
  if (tx.gasLimit * tx.maxFeePerGas > totalCeiling) fail('TOTAL_FEE_EXCEEDS_REVIEW');
  if (tx.value > valueCeiling) fail('VALUE_EXCEEDS_REVIEW');
  const frozenReview = Object.freeze({ ...review });
  return Object.freeze({ unsignedHex: raw, expectedUnsignedHash: expectedUnsignedHash.toLowerCase(), expectedPolicyHash: expectedPolicyHash.toLowerCase(), review: frozenReview, sender, expiry, expired, summary: Object.freeze({ chain: 'Ethereum Mainnet (1)', sender, operation: review.operationId, reviewedSourceSha256: review.sourceSha256, destination: tx.to ?? 'CREATE — recipient absent', nonce: tx.nonce, valueWei: tx.value.toString(), gasLimit: tx.gasLimit.toString(), maxFeePerGasWei: tx.maxFeePerGas.toString(), maxPriorityFeePerGasWei: tx.maxPriorityFeePerGas.toString(), maximumGasCostWei: (tx.gasLimit * tx.maxFeePerGas).toString(), dataBytes: (tx.data.length - 2) / 2, dataHash: keccak256(tx.data), accessList: tx.accessList, expiresAt: review.expiresAt, unsignedHash: expectedUnsignedHash.toLowerCase(), reviewedPolicyHash: expectedPolicyHash.toLowerCase() }) });
}
export function validatePath(path) {
  if (typeof path !== 'string' || !/^(?:[0-9]+'?\/){2,9}[0-9]+'?$/.test(path)) fail('INVALID_DERIVATION_PATH');
  if (path.split('/').some(x => Number(x.replace("'", '')) >= 2 ** 31)) fail('INVALID_DERIVATION_PATH');
  return path;
}
export function attachAndValidateSignature(prepared, signature, now = Date.now()) {
  const current = validateIntent(prepared.unsignedHex, prepared.expectedUnsignedHash, prepared.review, prepared.expectedPolicyHash, now, { allowExpired: true });
  if (!signature || ![0, 1, 27, 28].includes(signature.v) || !/^0x[0-9a-fA-F]{64}$/.test(signature.r ?? '') || !/^0x[0-9a-fA-F]{64}$/.test(signature.s ?? '')) fail('INVALID_DEVICE_SIGNATURE');
  let signed, recoveredSender;
  try {
    const tx = Transaction.from(current.unsignedHex);
    tx.signature = Signature.from(signature);
    signed = Transaction.from(tx.serialized);
    recoveredSender = signed.from;
  } catch { fail('INVALID_DEVICE_SIGNATURE'); }
  if (signed.type !== 2 || signed.unsignedSerialized !== current.unsignedHex || signed.unsignedHash !== current.expectedUnsignedHash) fail('SIGNED_ENVELOPE_MISMATCH');
  if (recoveredSender !== current.sender) fail('SIGNER_MISMATCH');
  return Object.freeze({ format: 'mainnet-ledger-signed-capability-v1', status: current.expired ? 'EXPIRED_SIGNED_CAPABILITY_DO_NOT_RELAY' : 'SIGNED_NOT_SUBMITTED', signedAt: new Date(now).toISOString(), transactionHash: signed.hash, unsignedTransaction: current.unsignedHex, expectedUnsignedHash: current.expectedUnsignedHash, expectedPolicyHash: current.expectedPolicyHash, review: current.review, signedTransaction: signed.serialized });
}
