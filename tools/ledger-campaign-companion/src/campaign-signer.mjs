import { validatePath, GateError } from './envelope.mjs';
import { coordinatorImport } from './coordinator-import.mjs';
import { makeCampaignUsbSigner } from './device.mjs';
import { CHANNEL_FORMAT, isLoopbackOrigin, channelNonce, requireMessage, validatePreparedPacket, preparedIdentity, sameIdentity, safeCode } from './campaign-protocol.mjs';

const $ = id => document.getElementById(id);
const parentOrigin = document.querySelector('meta[name="campaign-parent-origin"]')?.content;
let port, nonce, prepared, capability, previousSender, busy = false, attempted = false, durable = false;
const status = value => { $('signerStatus').textContent = value; };
const usb = makeCampaignUsbSigner(status);
const send = (type, extra = {}) => { port?.postMessage({ format: CHANNEL_FORMAT, nonce, type, ...extra }); };
function buttons() {
  $('signCampaign').disabled = !prepared || busy || attempted || Boolean(capability) || !$('deviceAck').checked || !$('path').value.trim();
  $('cancelCampaign').disabled = !busy;
  $('path').disabled = $('deviceAck').disabled = busy || attempted || Boolean(capability);
  $('downloadRecovery').disabled = !capability;
  $('downloadImport').disabled = !capability || Date.now() >= Date.parse(capability.review.expiresAt) || capability.status.startsWith('EXPIRED');
}
function reject(error) { status(`${safeCode(error)}. Recovery required; no automatic signing retry. / Reprise requise; aucune nouvelle signature automatique.`); }
function accept(message) {
  try {
    const value = requireMessage(message, nonce, ['prepare','durable','cancel','advance','block']);
    if (value.type === 'block') {
      attempted = true; if (busy) usb.cancel();
      status('CAMPAIGN_STOPPED_RECOVERY_REQUIRED. No further signing prompt; keep any private recovery. / Campagne arrêtée; reprise requise. Conservez toute copie privée.');
    } else if (value.type === 'prepare') {
      if (prepared || capability || busy || attempted) throw new GateError('RECOVERY_REQUIRED_NO_SECOND_PREPARE');
      prepared = validatePreparedPacket(value.prepared);
      if (previousSender && previousSender !== prepared.sender) { $('path').value = ''; usb.close?.(); }
      $('signerSummary').textContent = JSON.stringify(prepared.summary, null, 2);
      status('Exact intent validated. Choose your actual path; manually approve this operation only. / Intention exacte validée. Choisissez votre chemin réel; approuvez cette opération seulement.');
      send('prepared', { identity: preparedIdentity(prepared) });
    } else if (value.type === 'durable') {
      if (!capability || !sameIdentity(value.identity, preparedIdentity(prepared)) || value.transactionHash !== capability.transactionHash) throw new GateError('DURABLE_ACK_IDENTITY_MISMATCH');
      durable = true;
      status('Coordinator confirms durable private recovery. This frame keeps a private backup. / Le coordinateur confirme la reprise privée durable. Cette fenêtre conserve une copie.');
    } else if (value.type === 'advance') {
      if (!durable || !capability || busy || value.verified !== true || !sameIdentity(value.identity, preparedIdentity(prepared))) throw new GateError('VERIFIED_ADVANCE_REQUIRED');
      previousSender = prepared.sender; prepared = capability = undefined; attempted = durable = false; $('deviceAck').checked = false; $('signerSummary').textContent = '';
      status('Previous operation verified and privately preserved. Awaiting next exact manual approval. / Opération précédente vérifiée et conservée. Attente de la prochaine approbation.');
    } else if (value.type === 'cancel' && busy) { usb.cancel(); status('Cancellation requested. A returned signature still requires recovery. / Annulation demandée; toute signature retournée doit être conservée.'); }
  } catch (error) { reject(error); }
  buttons();
}
window.addEventListener('message', event => {
  if (port || window.parent === window || event.source !== window.parent || event.origin !== parentOrigin || !isLoopbackOrigin(event.origin) || event.origin === window.location.origin) return;
  try {
    const value = event.data;
    if (!value || Object.keys(value).sort().join('|') !== ['format','nonce','type'].sort().join('|') || value.format !== CHANNEL_FORMAT || value.type !== 'connect' || event.ports.length !== 1) throw new GateError('CHANNEL_CONNECT_REJECTED');
    nonce = channelNonce(value.nonce); port = event.ports[0]; port.onmessage = event => accept(event.data); port.start(); send('ready');
  } catch (error) { reject(error); }
});
$('path').addEventListener('input', () => { usb.close?.(); buttons(); }); $('deviceAck').addEventListener('change', buttons);
$('signCampaign').onclick = async () => {
  if (!prepared || busy || attempted || capability || !$('deviceAck').checked) return;
  try {
    validatePath($('path').value.trim());
    const current = validatePreparedPacket({ unsignedHex: prepared.unsignedHex, expectedUnsignedHash: prepared.expectedUnsignedHash, expectedPolicyHash: prepared.expectedPolicyHash, review: prepared.review });
    attempted = busy = true; buttons(); send('signing', { identity: preparedIdentity(current) });
    capability = await usb.sign(current, $('path').value.trim());
    let importFile;
    try { importFile = coordinatorImport(current, capability); } catch (error) { if (!(error instanceof GateError) || error.code !== 'COORDINATOR_IMPORT_EXPIRED_DO_NOT_RELAY') throw error; capability = Object.freeze({ ...capability, status: 'EXPIRED_SIGNED_CAPABILITY_DO_NOT_RELAY' }); }
    send('signed', { identity: preparedIdentity(current), capability, importAvailable: Boolean(importFile) });
    status(capability.status.startsWith('EXPIRED') ? 'DO_NOT_RELAY. Preserve the full private recovery; expiry cannot invalidate a signature. / Conservez la reprise privée; l’expiration n’annule pas la signature.' : 'Exact recovered signer and envelope verified. Awaiting durable coordinator recovery. / Signataire et enveloppe exacts vérifiés. Attente de la reprise durable.');
  } catch (error) { attempted = true; reject(error); send('recovery', { identity: prepared && preparedIdentity(prepared), code: safeCode(error) }); }
  finally { busy = false; buttons(); }
};
$('cancelCampaign').onclick = () => { usb.cancel(); status('Cancellation requested; wait for recovery. / Annulation demandée; attendre la reprise.'); };
function download(value, filename) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' }));
  const link = document.createElement('a'); link.href = url; link.download = filename; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
$('downloadRecovery').onclick = () => {
  if (!capability) return;
  try {
    const value = Date.now() >= Date.parse(capability.review.expiresAt) ? { ...capability, status: 'EXPIRED_SIGNED_CAPABILITY_DO_NOT_RELAY' } : capability;
    download(value, `${capability.review.operationId}.signed.private.json`);
    status('Private recovery download requested. Confirm your browser saved it; keep this frame open if downloads are blocked. / Téléchargement privé demandé. Vérifiez la sauvegarde; gardez cette fenêtre si bloquée.');
  } catch { status('DOWNLOAD_FAILED_KEEP_FRAME_OPEN. Private capability retained. / Copie privée conservée; garder cette fenêtre ouverte.'); }
  buttons();
};
$('downloadImport').onclick = () => {
  if (!capability) return;
  try { download(coordinatorImport(prepared, capability), `${capability.review.operationId}.coordinator-import.private.json`); }
  catch (error) { reject(error); }
  buttons();
};
window.addEventListener('beforeunload', event => { if (busy || (attempted && !durable) || capability) { event.preventDefault(); event.returnValue = ''; } port?.close(); usb.close?.(); });
buttons();
