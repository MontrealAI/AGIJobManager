import { GateError } from './envelope.mjs';
import { coordinatorImport } from './coordinator-import.mjs';
import { validateCampaignStatus, stateLabel, nextStep } from './campaign-model.mjs';
import { CHANNEL_FORMAT, bounded, requireMessage, validatePreparedPacket, preparedIdentity, sameIdentity, safeCode } from './campaign-protocol.mjs';

const $ = id => document.getElementById(id);
let token, snapshot, reviewedIdentity, current, port, nonce, busy = false, polling = false, stopped = false, requestPending = false;
const monitor = new Map(), relayRequests = new Set();
const MAX_READ_ATTEMPTS = 360, MAX_READ_WINDOW_MS = 30 * 60 * 1000;
const status = text => { $('campaignStatus').textContent = text; };
const node = (tag, text) => { const e = document.createElement(tag); if (text !== undefined) e.textContent = text; return e; };
const json = value => JSON.stringify(value, null, 2);
const identity = c => json({ campaignId: c.campaignId, identity: c.identity, route: c.route, actors: c.actors, maxTotalFeeWei: c.maxTotalFeeWei, operations: c.operations, expiresAt: c.expiresAt, coordinatorDetails: c.coordinatorDetails });
function facts(id, entries) { const dl = node('dl'); dl.className = 'facts'; for (const [key, value] of entries) { dl.append(node('dt', key), node('dd', typeof value === 'string' ? value : json(value))); } $(id).replaceChildren(dl); }
const approver = op => snapshot.campaign.actors[op.account] ?? op.account;
async function api(name, body = {}) {
  if (requestPending) throw new GateError('REQUEST_IN_PROGRESS');
  requestPending = true;
  try {
    const headers = { 'Content-Type': 'application/json', 'X-Companion-Request': '1' }; if (token) headers.Authorization = `Bearer ${token}`;
    const response = await fetch(`/api/${name}`, { method: 'POST', headers, body: JSON.stringify(body), credentials: 'omit', cache: 'no-store', redirect: 'error' });
    const text = await response.text(); if (new TextEncoder().encode(text).byteLength > 400 * 1024) throw new GateError('BRIDGE_RESPONSE_REJECTED');
    let value; try { value = JSON.parse(text); } catch { throw new GateError('BRIDGE_RESPONSE_REJECTED'); }
    bounded(value);
    if (!response.ok) throw new GateError(typeof value.code === 'string' && /^[A-Z][A-Z0-9_]{0,95}$/.test(value.code) ? value.code : 'BRIDGE_REQUEST_REJECTED');
    return value;
  } catch (error) { if (error instanceof GateError) throw error; throw new GateError('BRIDGE_UNAVAILABLE_RECOVERY_REQUIRED'); }
  finally { requestPending = false; }
}
function controls() {
  const step = snapshot && nextStep(snapshot);
  if (current && (stopped || snapshot?.sourceBlocked === true || snapshot?.bridgeRecoveryRequired === true) && !current.blockSent) { current.blockSent = true; send('block', { code: 'CAMPAIGN_STOPPED_RECOVERY_REQUIRED' }); }
  $('prepareNext').disabled = busy || stopped || (snapshot?.sourceBlocked === true || snapshot?.bridgeRecoveryRequired === true) || !step || Boolean(current) || !$('campaignAck').checked || !['awaiting-owner-approval','prepared'].includes(step.state);
  $('recoverCampaign').disabled = busy || !step || !step.operationId;
  $('relayExact').disabled = busy || stopped || (snapshot?.sourceBlocked === true || snapshot?.bridgeRecoveryRequired === true) || !snapshot?.relayEnabled || !step || step.state !== 'signed' || typeof step.acknowledgement !== 'string' || relayRequests.has(step.operationId) || step.relayAttempted === true;
  $('refreshCampaign').disabled = busy;
  $('campaignAck').disabled = busy || Boolean(current);
  $('downloadReport').disabled = busy || !snapshot;
}
function render(value) {
  validateCampaignStatus(value);
  if (value.signerOrigin === window.location.origin) throw new GateError('CROSS_ORIGIN_SIGNER_REQUIRED');
  const key = identity(value.campaign);
  if (reviewedIdentity && reviewedIdentity !== key) { $('campaignAck').checked = false; stopped = true; throw new GateError('CAMPAIGN_DRIFT_RECOVERY_REQUIRED'); }
  snapshot = value;
  const relayStep = nextStep(value);
  const relayReady = value.relayEnabled && relayStep?.state === 'signed' && typeof relayStep.acknowledgement === 'string' && relayStep.relayAttempted !== true;
  $('relayReview').hidden = !relayReady; $('relayReview').textContent = relayReady ? json({ purpose: 'Exact coordinator one-shot relay acknowledgement / Autorisation exacte d’envoi unique', operationId: relayStep.operationId, transactionHash: relayStep.transactionHash, acknowledgement: relayStep.acknowledgement, envelope: value.campaign.operations[relayStep.index].envelope }) : '';
  const c = value.campaign;
  $('coordinatorDetails').textContent = json(c.coordinatorDetails ?? { configurationScope: 'Not supplied / Non fourni; unsupported configuration cannot be executed' });
  facts('campaignSummary', [['Network / Réseau', `${c.network.name} · chain ${c.network.chainId}`], ['Route', `${c.route.name} · ${c.route.symbol} · ${c.route.decimals} decimals`], ['Token / Jeton', c.route.token], ['Source', `${c.identity.repository} @ ${c.identity.commit}`], ['Tree / Arbre', c.identity.tree], ['Build / Compilation', c.identity.buildId ?? 'Not supplied / Non fourni'], ['Source SHA-256', c.identity.sourceSha256], ['Plan SHA-256', c.identity.planSha256], ['Packet schema', c.identity.packetSchema], ['Campaign expiry / Expiration', c.expiresAt], ['Maximum fees / Frais maximaux', `${c.maxTotalFeeWei} wei (gas ceiling, not a quote)`], ['Operations / Opérations', `${value.steps.filter(s => s.state === 'verified').length} / ${c.operations.length} verified; ${value.steps.filter(s => s.state !== 'verified').length} remaining`]]);
  facts('qualification', [...Object.entries(c.qualification), ['Full authority / Autorité complète', value.readiness.authorityComplete], ['Activation ready / Activation prête', value.readiness.activationReady], ['Physical wallet / Appareil physique', value.readiness.physicalQualified], ['Source read-only / Source lecture seule', value.sourceBlocked === true], ['Bridge recovery / Reprise du pont', value.bridgeRecoveryRequired === true], ['Relay / Envoi', value.relayEnabled ? 'Separate exact coordinator acknowledgement required' : 'Disabled / Désactivé']]);
  facts('actors', [['Creator / Créateur', c.actors.creator], ['Governor / Gouverneur', c.actors.governor], ...c.actors.feeRecipients.map(a => [`Fee / Frais: ${a.role}`, a.address]), ...c.actors.treasuries.map(a => [`Treasury / Trésorerie: ${a.role}`, a.address])]);
  const step = nextStep(value), next = $('nextOperation'); next.replaceChildren();
  if (!step) next.append(node('p', 'All listed operations verified. Comprehensive authority and activation retain their own gates. / Toutes les opérations listées sont vérifiées. Autorité complète et activation restent soumises à leurs contrôles.'));
  else { const op = c.operations[step.index]; next.append(node('p', `${step.index + 1}. ${op.purpose}`), node('p', `${stateLabel(step.state)} · ${approver(op)}`)); if (step.blocker) next.append(node('p', step.blocker)); }
  const steps = $('steps'); steps.replaceChildren();
  c.operations.forEach((op, i) => { const detail = node('details'); detail.className = 'operation'; const summary = node('summary', `${i + 1}. ${op.purpose} — ${stateLabel(value.steps[i].state)}`); detail.append(summary, node('pre', json({ ...op, exactApprover: approver(op), state: value.steps[i].state, operationId: value.steps[i].operationId, transactionHash: value.steps[i].transactionHash, blocker: value.steps[i].blocker, relayAttempted: value.steps[i].relayAttempted, verification: value.steps[i].verification ?? { state: 'not-performed', blocker: 'EXPLORER_AND_CONFIGURATION_HAVE_SEPARATE_GATES' } }))); steps.append(detail); });
  controls();
}
async function refresh() { render(await api('status')); }
function send(type, extra = {}) { port?.postMessage({ format: CHANNEL_FORMAT, nonce, type, ...extra }); }
function attachSigner(prepared, step, operationId) {
  if (port && !$('signFrame').hidden) {
    current = { prepared, step, operationId, identity: preparedIdentity(prepared), imported: false };
    send('prepare', { prepared: { unsignedHex: prepared.unsignedHex, expectedUnsignedHash: prepared.expectedUnsignedHash, expectedPolicyHash: prepared.expectedPolicyHash, review: prepared.review } });
    return;
  }
  port?.close();
  const old = $('signFrame'), frame = old.cloneNode(false); old.replaceWith(frame); frame.hidden = false;
  nonce = [...crypto.getRandomValues(new Uint8Array(32))].map(x => x.toString(16).padStart(2, '0')).join('');
  const channel = new MessageChannel(); port = channel.port1;
  current = { prepared, step, operationId, identity: preparedIdentity(prepared), imported: false };
  port.onmessage = async event => {
    try {
      const value = requireMessage(event.data, nonce, ['ready','prepared','signing','signed','recovery']);
      if (value.type === 'ready') { send('prepare', { prepared: { unsignedHex: prepared.unsignedHex, expectedUnsignedHash: prepared.expectedUnsignedHash, expectedPolicyHash: prepared.expectedPolicyHash, review: prepared.review } }); return; }
      if (!sameIdentity(value.identity, current.identity)) throw new GateError('SIGNER_RESPONSE_IDENTITY_MISMATCH');
      if (value.type === 'prepared') { status('Durable intent and actor locks are held. Manually approve this exact operation in the isolated signer. / Intention durable et verrous acquis. Approuvez cette opération dans le signataire isolé.'); return; }
      if (value.type === 'signing') { busy = true; controls(); status('Awaiting manual physical Ledger approval. / En attente de votre approbation physique sur Ledger.'); return; }
      if (value.type === 'recovery') throw new GateError('DEVICE_OUTCOME_RECOVERY_REQUIRED');
      if (current.imported) throw new GateError('DUPLICATE_SIGNATURE_RESULT_REJECTED');
      // Revalidate from the original prepared envelope; never trust the child-provided capability metadata.
      try { coordinatorImport(current.prepared, value.capability); }
      catch (error) { if (!(error instanceof GateError) || error.code !== 'COORDINATOR_IMPORT_EXPIRED_DO_NOT_RELAY') throw error; }
      current.imported = true; busy = true; controls();
      const result = await api('import', { step: current.step, operationId: current.operationId, capability: value.capability });
      if (result.transactionHash !== value.capability.transactionHash || result.durable !== true) throw new GateError('PRIVATE_RECOVERY_NOT_CONFIRMED');
      send('durable', { identity: current.identity, transactionHash: result.transactionHash });
      status('Signed capability durably preserved by the coordinator. Relay remains separately gated. / Signature conservée durablement par le coordinateur. L’envoi reste soumis à une autorisation distincte.');
      await refresh(); busy = false; controls(); scheduleObserve();
    } catch (error) { busy = false; stopped = true; status(`${safeCode(error)}. Keep the signer frame open and preserve its full private recovery. / Gardez le signataire ouvert et conservez sa reprise privée.`); controls(); }
  };
  port.start();
  let loaded = false;
  frame.onload = () => {
    if (loaded) { stopped = true; busy = false; port?.close(); status('SIGNER_NAVIGATION_RECOVERY_REQUIRED. No new signing prompt. / Navigation du signataire; reprise requise.'); controls(); return; }
    loaded = true; frame.contentWindow.postMessage({ format: CHANNEL_FORMAT, nonce, type: 'connect' }, snapshot.signerOrigin, [channel.port2]);
  };
  frame.src = `${snapshot.signerOrigin}/campaign-signer.html`;
}
$('campaignAck').addEventListener('change', () => { if ($('campaignAck').checked && snapshot) reviewedIdentity = identity(snapshot.campaign); controls(); });
$('prepareNext').onclick = async () => {
  if ($('prepareNext').disabled || busy) return;
  busy = true; controls();
  try {
    await refresh(); const step = nextStep(snapshot);
    if (!step || current || !['awaiting-owner-approval','prepared'].includes(step.state) || reviewedIdentity !== identity(snapshot.campaign)) throw new GateError('REVIEW_AGAIN_REQUIRED');
    const result = await api('prepare', { step: step.index });
    if (result.step !== step.index || result.state !== 'signing-requested' || result.operationId !== result.prepared?.review?.operationId) throw new GateError('DURABLE_SIGNING_INTENT_REQUIRED');
    const prepared = validatePreparedPacket(result.prepared);
    if (prepared.sender.toLowerCase() !== approver(snapshot.campaign.operations[step.index]).toLowerCase()) throw new GateError('CAMPAIGN_APPROVER_MISMATCH');
    attachSigner(prepared, step.index, result.operationId);
    status('Intent saved before device access. Review the exact fields and manually approve the Ledger request. / Intention enregistrée avant l’accès appareil. Examinez les champs exacts et approuvez sur Ledger.');
  } catch (error) { stopped = true; status(`${safeCode(error)}. Read-only recovery is available; signing is stopped. / Reprise en lecture seule disponible; signature arrêtée.`); }
  finally { busy = false; controls(); }
};
async function observe() {
  const step = snapshot && nextStep(snapshot); if (!step?.operationId) return;
  await api('observe', { step: step.index, operationId: step.operationId }); await refresh();
  const after = snapshot.steps[step.index];
  if (after.state === 'verified' && current?.step === step.index) {
    send('advance', { identity: current.identity, verified: true }); current = undefined; stopped = false;
    status('Exact operation verified. The next approved step can be prepared. / Opération exacte vérifiée. La prochaine étape approuvée peut être préparée.');
    controls();

  }
}
async function continueApproved() {
  controls(); if (!busy && !stopped && !current && $('campaignAck').checked && !$('prepareNext').disabled) await $('prepareNext').onclick();
}
function scheduleObserve() {
  if (polling || stopped) return; const step = snapshot && nextStep(snapshot);
  if (!step?.transactionHash || !['submitted','pending','finalized'].includes(step.state)) return;
  const record = monitor.get(step.operationId) ?? { startedAt: Date.now(), attempts: 0 }; monitor.set(step.operationId, record);
  if (record.attempts >= MAX_READ_ATTEMPTS || Date.now() - record.startedAt >= MAX_READ_WINDOW_MS) { stopped = true; status('MONITOR_LIMIT_RECOVERY_REQUIRED. Automatic observation reached 360 observation cycles or 30 minutes. No resend. / Limite d’observation atteinte; reprise en lecture seule, aucun renvoi.'); controls(); return; }
  record.attempts += 1;
  polling = true; setTimeout(async () => { polling = false; if (busy || stopped) return; busy = true; controls(); try { await observe(); } catch (error) { stopped = true; status(`${safeCode(error)}. Observation stopped; no resend. / Observation arrêtée; aucun renvoi.`); } finally { busy = false; controls(); await continueApproved(); scheduleObserve(); } }, 5000);
}
$('relayExact').onclick = async () => {
  if ($('relayExact').disabled || busy) return; const step = nextStep(snapshot);
  if (!step || relayRequests.has(step.operationId) || typeof step.acknowledgement !== 'string') return;
  relayRequests.add(step.operationId); busy = true; controls();
  try {
    const result = await api('relay', { step: step.index, operationId: step.operationId, acknowledgement: step.acknowledgement });
    if (result.transactionHash !== step.transactionHash || !['submitted','pending','finalized','verified'].includes(result.state)) throw new GateError('RELAY_OUTCOME_RECOVERY_REQUIRED');
    await refresh(); status('Exact coordinator relay attempted once. Monitoring the known hash; no resend or fee replacement. / Envoi exact tenté une fois; suivi du hachage connu, aucun renvoi ni remplacement de frais.');
  } catch (error) { stopped = true; status(`${safeCode(error)}. Relay outcome requires read-only recovery; no automatic retry. / Reprise en lecture seule requise; aucune nouvelle tentative automatique.`); }
  finally { busy = false; controls(); scheduleObserve(); }
};
$('refreshCampaign').onclick = async () => { if (busy) return; busy = true; controls(); try { await refresh(); status('Status refreshed; no signing or relay requested. / État actualisé; aucune signature ni aucun envoi demandé.'); scheduleObserve(); } catch (error) { stopped = true; status(safeCode(error)); } finally { busy = false; controls(); } };
$('recoverCampaign').onclick = async () => { if (busy) return; busy = true; controls(); try { await observe(); status('Read-only observation complete. Never infer permission to resend from a missing receipt. / Observation en lecture seule terminée. Une absence de reçu n’autorise jamais un renvoi.'); } catch (error) { stopped = true; status(safeCode(error)); } finally { busy = false; controls(); await continueApproved(); } };
$('downloadReport').onclick = async () => { if (busy) return; busy = true; controls(); try { const report = await api('report'); const url = URL.createObjectURL(new Blob([json(report)], { type: 'application/json' })); const a = node('a'); a.href = url; a.download = 'campaign-sanitized-report.json'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); status('Sanitized report download requested. / Téléchargement du rapport expurgé demandé.'); } catch (error) { status(safeCode(error)); } finally { busy = false; controls(); } };
window.addEventListener('beforeunload', event => { if (busy || current) { event.preventDefault(); event.returnValue = ''; } port?.close(); });
async function start() {
try {
  const session = await api('session'); if (typeof session.token !== 'string' || !/^[A-Za-z0-9_-]{32,256}$/.test(session.token)) throw new GateError('SESSION_REJECTED'); token = session.token;
  await refresh(); const step = nextStep(snapshot);
  status(step && ['signing-requested','signed','submitted','pending','finalized','recovery-required'].includes(step.state) ? 'Existing durable operation found. Use read-only recovery; no repeated signing prompt. / Opération durable retrouvée. Reprise en lecture seule; aucune nouvelle demande de signature.' : 'Review the campaign once. Every transaction still requires your manual Ledger approval. / Examinez la campagne. Chaque transaction exige votre approbation manuelle sur Ledger.');
  scheduleObserve();
} catch (error) { stopped = true; status(safeCode(error)); }
controls();

}
start();
