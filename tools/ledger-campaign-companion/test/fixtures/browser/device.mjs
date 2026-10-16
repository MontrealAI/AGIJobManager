// TEST BUILD ONLY. scripts/browser-build.mjs aliases this module; production builds never reference it.
import { SigningKey, getBytes } from 'ethers';
import { validateIntent, validatePath, attachAndValidateSignature, GateError } from '../../../src/envelope.mjs';
const TEST_KEY = `0x${'19'.repeat(32)}`;
export function makeUsbSigner(onStatus) {
  let cancel;
  return {
    async sign(prepared, path) {
      const fixture = globalThis.__COMPANION_BROWSER_TEST__;
      if (!fixture || fixture.testOnly !== true) throw new GateError('TEST_BUILD_REQUIRES_SYNTHETIC_DEVICE');
      fixture.calls = (fixture.calls ?? 0) + 1;
      validatePath(path);
      validateIntent(prepared.unsignedHex, prepared.expectedUnsignedHash, prepared.review, prepared.expectedPolicyHash);
      if (fixture.mode === 'account-mismatch') throw new GateError('DEVICE_ADDRESS_MISMATCH');
      if (fixture.mode === 'path-mismatch' || path !== "44'/60'/0'/0/0") throw new GateError('DEVICE_ADDRESS_MISMATCH');
      if (fixture.mode === 'reject') throw new GateError('DEVICE_ACTION_STOPPED_OR_FAILED');
      if (fixture.mode === 'disconnect') throw new GateError('DEVICE_ACTION_FAILED');
      if (fixture.mode === 'raw-error') throw new Error('PRIVATE_DEVICE_RESPONSE_MUST_NOT_APPEAR_0xdeadbeef');
      if (fixture.mode === 'wait') await new Promise((resolve, reject) => { cancel = () => reject(new GateError('DEVICE_ACTION_STOPPED_OR_FAILED')); fixture.release = resolve; });
      onStatus('TEST_ONLY_SYNTHETIC_DEVICE_ADDRESS_CONFIRMED');
      // Model bounded transport chunks without claiming Ledger APDU/device acceptance.
      const bytes = getBytes(prepared.unsignedHex);
      fixture.byteLength = bytes.length;
      fixture.chunkCount = Math.ceil(bytes.length / 255);
      if (fixture.mode === 'expire-after-approval') fixture.now = Date.parse(prepared.review.expiresAt) + 1;
      return attachAndValidateSignature(prepared, new SigningKey(fixture.mode === 'account-changed' ? `0x${'20'.repeat(32)}` : TEST_KEY).sign(prepared.expectedUnsignedHash));
    },
    cancel() { cancel?.(); }
  };
}
export function makeCampaignUsbSigner(onStatus) { return { ...makeUsbSigner(onStatus), close() {} }; }
