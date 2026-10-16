import { validateIntent, validatePath, GateError } from './envelope.mjs';
import { coordinatorImport } from './coordinator-import.mjs';
import { makeUsbSigner } from './device.mjs';

const $ = id => document.getElementById(id);
let prepared, capability, busy = false;
const status = message => { $('status').textContent = message; };
const usb = makeUsbSigner(status);
const fields = ['unsigned', 'expectedHash', 'expectedPolicyHash', 'review', 'path', 'ack'];
function read() {
  let review;
  try { review = JSON.parse($('review').value); } catch { throw new GateError('INVALID_REVIEW_JSON'); }
  validatePath($('path').value.trim());
  return validateIntent($('unsigned').value.trim(), $('expectedHash').value.trim(), review, $('expectedPolicyHash').value.trim());
}
function clearReview() {
  if (busy || capability) return;
  prepared = undefined;
  $('sign').disabled = true;
  $('summary').textContent = '';
}
fields.forEach(id => $(id).addEventListener('input', clearReview));
$('validate').onclick = () => {
  try {
    prepared = read();
    $('summary').textContent = JSON.stringify(prepared.summary, null, 2);
    $('sign').disabled = !$('ack').checked;
    status('Envelope validated locally. No device access has occurred. Confirm the hash and summary against your independent review.');
  } catch (error) { clearReview(); status(error instanceof GateError ? error.code : 'VALIDATION_FAILED'); }
};
$('sign').onclick = async () => {
  if (busy || capability) return;
  try {
    const current = read();
    if (!prepared || current.unsignedHex !== prepared.unsignedHex || current.expectedPolicyHash !== prepared.expectedPolicyHash || JSON.stringify(current.review) !== JSON.stringify(prepared.review) || !$('ack').checked) throw new GateError('REVIEW_AGAIN_REQUIRED');
    busy = true;
    fields.forEach(id => { $(id).disabled = true; });
    $('validate').disabled = $('sign').disabled = true;
    $('cancel').disabled = false;
    capability = await usb.sign(current, $('path').value.trim());
    $('download').disabled = false;
    $('downloadImport').disabled = capability.status.startsWith('EXPIRED');
    $('download').textContent = capability.status.startsWith('EXPIRED') ? 'Download full private recovery file — DO_NOT_RELAY' : 'Download full private recovery file';
    status(capability.status.startsWith('EXPIRED') ? 'DO_NOT_RELAY: a valid exact signature returned after local expiry. Preserve its full private recovery file; this transaction is still executable on Ethereum. Coordinator-import export is refused.' : `Signature validated. Transaction ${capability.transactionHash}. Nothing was submitted. Preserve the full private recovery file before closing; the separate coordinator-import file contains only raw signed bytes.`);
  } catch (error) {
    status(`${error instanceof GateError ? error.code : 'SIGNING_FAILED'}. No automatic retry. If approval or response was interrupted, return to coordinator recovery before another signing attempt.`);
  } finally {
    busy = false;
    $('cancel').disabled = true;
    if (!capability) fields.forEach(id => { $(id).disabled = false; });
  }
};
$('cancel').onclick = () => { usb.cancel(); status('Cancellation requested. Wait for the result; do not assume cancellation erased a signature.'); };
function downloadJSON(value, filename) {
  const blob = new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
}
$('download').onclick = () => {
  if (!capability) return;
  const exported = Date.now() >= Date.parse(capability.review.expiresAt) ? { ...capability, status: 'EXPIRED_SIGNED_CAPABILITY_DO_NOT_RELAY' } : capability;
  downloadJSON(exported, `${capability.review.operationId}.signed.private.json`);
  if (exported.status.startsWith('EXPIRED')) {
    $('downloadImport').disabled = true;
    $('download').textContent = 'Download full private recovery file — DO_NOT_RELAY';
    status('DO_NOT_RELAY: the full private recovery file is preserved. Local expiry does not cancel its Ethereum signature. Coordinator-import export is refused. Return to coordinator recovery.');
  }
};
$('downloadImport').onclick = () => {
  if (!capability) return;
  try {
    const exported = coordinatorImport(prepared, capability);
    downloadJSON(exported, `${capability.review.operationId}.coordinator-import.private.json`);
    status('Private coordinator-import file downloaded. Nothing was submitted. This source-only format bridge does not satisfy the coordinator source, campaign, intent, nonce, expiry, lock or relay gates. Keep the full recovery file too.');
  } catch (error) {
    $('downloadImport').disabled = true;
    status(`${error instanceof GateError ? error.code : 'COORDINATOR_IMPORT_REFUSED_DO_NOT_RELAY'}. No import file was created. Preserve the full private recovery file and return to coordinator recovery.`);
  }
};
window.addEventListener('beforeunload', event => {
  if (busy || capability) { event.preventDefault(); event.returnValue = ''; }
});
status('Source preview. Physical USB Ledger acceptance has not been performed.');
