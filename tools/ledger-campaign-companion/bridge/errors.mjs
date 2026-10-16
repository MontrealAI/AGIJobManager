export class BridgeError extends Error {
  constructor(code = 'REQUEST_REJECTED') { super(code); this.code = code; }
}
export const reject = code => { throw new BridgeError(code); };
export function exactFields(value, fields) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.getPrototypeOf(value) !== Object.prototype || Object.keys(value).sort().join('|') !== [...fields].sort().join('|')) reject('INVALID_REQUEST');
}
export function publicError(error) {
  return { error: 'REQUEST_REJECTED', code: error instanceof BridgeError ? error.code : 'OPERATION_BLOCKED' };
}
