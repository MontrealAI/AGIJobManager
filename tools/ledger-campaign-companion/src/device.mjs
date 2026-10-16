import { DeviceActionStatus, DeviceManagementKitBuilder, DeviceStatus } from '@ledgerhq/device-management-kit';
import { SignerEthBuilder } from '@ledgerhq/device-signer-kit-ethereum';
import { webHidTransportFactory } from '@ledgerhq/device-transport-kit-web-hid';
import { firstValueFrom, take } from 'rxjs';
import { getAddress, getBytes } from 'ethers';
import { validateIntent, validatePath, attachAndValidateSignature, GateError } from './envelope.mjs';

export function makeUsbSigner(onStatus, { keepSession = false } = {}) {
  let dmk, sessionId, cancelAction, active = false, sessionSub, signer, verifiedPath, verifiedSender, validSession = false;
  async function close() {
    validSession = false; verifiedPath = verifiedSender = undefined; signer = undefined;
    sessionSub?.unsubscribe(); sessionSub = undefined;
    const oldId = sessionId, oldDmk = dmk; sessionId = dmk = undefined;
    if (oldId && oldDmk) { try { await oldDmk.disconnect({ sessionId: oldId }); } catch {} }
    try { oldDmk?.close(); } catch {}
  }
  const requireCurrent = prepared => validateIntent(prepared.unsignedHex, prepared.expectedUnsignedHash, prepared.review, prepared.expectedPolicyHash);
  function actionResult(action) {
    cancelAction = action.cancel;
    return new Promise((resolve, reject) => {
      let sub, settled = false, timer;
      const finish = (fn, value) => { if (settled) return; settled = true; clearTimeout(timer); fn(value); queueMicrotask(() => sub?.unsubscribe()); cancelAction = undefined; };
      if (keepSession) timer = setTimeout(() => { try { action.cancel(); } catch {} finish(reject, new GateError('DEVICE_TIMEOUT_RECOVERY_REQUIRED')); }, 180000);
      sub = action.observable.subscribe({
        next: state => {
          if (state.status === DeviceActionStatus.Completed) finish(resolve, state.output);
          else if (state.status === DeviceActionStatus.Error || state.status === DeviceActionStatus.Stopped) finish(reject, new GateError('DEVICE_ACTION_STOPPED_OR_FAILED'));
          else if (state.status === DeviceActionStatus.Pending) onStatus('Follow the Ledger screen. The host cannot certify what the screen displays.');
        },
        error: () => finish(reject, new GateError('DEVICE_ACTION_FAILED')),
        complete: () => { if (!settled) finish(reject, new GateError('DEVICE_RETURNED_NO_RESULT')); }
      });
    });
  }
  return {
    async sign(prepared, path) {
      if (active) throw new GateError('SESSION_ALREADY_ACTIVE');
      active = true;
      try {
        validatePath(path);
        requireCurrent(prepared);
        if (!globalThis.isSecureContext || !('hid' in navigator)) throw new GateError('WEBHID_SECURE_CONTEXT_REQUIRED');
        const reuse = keepSession && validSession && sessionId && signer && verifiedPath === path && verifiedSender === prepared.sender;
        if (!reuse) {
          await close();
          dmk = new DeviceManagementKitBuilder().addTransport(webHidTransportFactory).build();
          onStatus('Select your USB Ledger in the browser picker.');
          const device = await firstValueFrom(dmk.startDiscovering({}).pipe(take(1)));
          await dmk.stopDiscovering();
          requireCurrent(prepared);
          sessionId = await dmk.connect({ device, sessionRefresherOptions: { isRefresherDisabled: true } });
          validSession = true;
          sessionSub = dmk.getDeviceSessionState({ sessionId }).subscribe({
            next: state => { if (state.deviceStatus === DeviceStatus.NOT_CONNECTED) { validSession = false; cancelAction?.(); } },
            error: () => { validSession = false; cancelAction?.(); }
          });
          signer = new SignerEthBuilder({ dmk, sessionId }).build();
          requireCurrent(prepared);
          onStatus('Verify the exact account address on your Ledger.');
          const account = await actionResult(signer.getAddress(path, { checkOnDevice: true }));
          if (getAddress(account.address) !== prepared.sender) throw new GateError('DEVICE_ADDRESS_MISMATCH');
          verifiedPath = path; verifiedSender = prepared.sender;
        } else {
          onStatus('Checking the previously device-confirmed account before this manual transaction approval.');
          const account = await actionResult(signer.getAddress(path, { checkOnDevice: false }));
          if (getAddress(account.address) !== prepared.sender) throw new GateError('DEVICE_ADDRESS_MISMATCH');
        }
        if (!validSession || verifiedPath !== path || verifiedSender !== prepared.sender) throw new GateError('DEVICE_SESSION_CHANGED_RECOVERY_REQUIRED');
        requireCurrent(prepared);
        onStatus('Review this exact transaction on the Ledger. Network context is blocked; blind signing may be required or the device may refuse.');
        const signature = await actionResult(signer.signTransaction(path, getBytes(prepared.unsignedHex)));
        return attachAndValidateSignature(prepared, signature);
      } catch (error) {
        await close();
        if (error instanceof GateError) throw error;
        throw new GateError('USB_SIGNING_FAILED_NO_AUTOMATIC_RETRY');
      } finally {
        if (!keepSession || !validSession) await close();
        active = false;
      }
    },
    cancel() { cancelAction?.(); },
    close() { cancelAction?.(); return close(); }
  };
}

// Campaign-only reuse retains one confirmed account session; every transaction still invokes the device approval action.
export const makeCampaignUsbSigner = onStatus => makeUsbSigner(onStatus, { keepSession: true });
