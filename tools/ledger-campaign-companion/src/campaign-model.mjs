import { getAddress } from 'ethers';
import { GateError } from './envelope.mjs';
import { bounded, isLoopbackOrigin, STATES } from './campaign-protocol.mjs';
const fail = () => { throw new GateError('CAMPAIGN_STATUS_REJECTED'); };
const text = (v, n = 256) => { if (typeof v !== 'string' || !v.length || v.length > n || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(v)) fail(); return v; };
const address = v => { try { if (getAddress(v) === '0x0000000000000000000000000000000000000000') fail(); return v; } catch { fail(); } };
const decimal = v => { if (typeof v !== 'string' || !/^(0|[1-9][0-9]{0,77})$/.test(v)) fail(); return v; };
const object = v => { if (!v || typeof v !== 'object' || Array.isArray(v)) fail(); return v; };
const list = (v, limit) => { if (!Array.isArray(v) || v.length > limit) fail(); return v; };
export function validateCampaignStatus(value) {
  bounded(value); object(value);
  if (value.format !== 'manual-ledger-campaign-status-v1' || !isLoopbackOrigin(value.signerOrigin) || typeof value.relayEnabled !== 'boolean') fail();
  for (const key of ['sourceBlocked','bridgeRecoveryRequired']) if (value[key] !== undefined && typeof value[key] !== 'boolean') fail();
  const c = object(value.campaign); text(c.campaignId, 96); object(c.identity); object(c.network); object(c.route); object(c.actors); object(c.qualification); object(value.readiness);
  for (const key of ['repository','packetSchema']) text(c.identity[key]);
  if (c.identity.buildId !== undefined) text(c.identity.buildId);
  if (typeof c.expiresAt !== 'string' || !Number.isFinite(Date.parse(c.expiresAt))) fail();
  for (const key of ['commit','tree']) if (!/^[a-f0-9]{40}$/.test(c.identity[key])) fail();
  for (const key of ['sourceSha256','planSha256']) if (!/^(?:0x)?[a-f0-9]{64}$/.test(c.identity[key])) fail();
  if (c.network.chainId !== '1') fail(); text(c.network.name); text(c.route.name); text(c.route.token); text(c.route.symbol, 32);
  if (!Number.isInteger(c.route.decimals) || c.route.decimals < 0 || c.route.decimals > 36 || (c.route.symbol.replace(/^\$/, '') === 'USDC' && c.route.decimals !== 6) || (c.route.symbol.replace(/^\$/, '') === 'AGIALPHA' && c.route.decimals !== 18)) fail();
  address(c.actors.creator); address(c.actors.governor);
  for (const key of ['feeRecipients','treasuries']) for (const a of list(c.actors[key], 32)) { object(a); text(a.role, 96); address(a.address); }
  for (const key of ['source','browser','coordinator','physical','provider','configuration','explorer','authority']) { const q = c.qualification[key]; if (typeof q !== 'boolean') text(q, 512); }
  decimal(c.maxTotalFeeWei);
  const ops = list(c.operations, 128), steps = list(value.steps, 128); if (!ops.length || ops.length !== steps.length) fail();
  ops.forEach((op, i) => { object(op); if (op.index !== i) fail(); text(op.purpose, 1024); if (!['creator','governor'].includes(op.account)) address(op.account); text(op.destination, 128); list(op.dependsOn, 128).forEach(x => { if (!Number.isInteger(x) || x < 0 || x >= i) fail(); }); if (op.decodedArguments === undefined || op.expectedPostState === undefined) fail(); const e = object(op.envelope); address(e.sender); text(e.destination); if (e.chain !== 'Ethereum Mainnet (1)' || e.sender.toLowerCase() !== (c.actors[op.account] ?? op.account).toLowerCase() || typeof e.destination !== 'string' || op.destination.toLowerCase() !== (e.destination.startsWith('CREATE —') ? 'create' : e.destination.toLowerCase())) fail(); for (const key of ['valueWei','gasLimit','maxFeePerGasWei','maxPriorityFeePerGasWei','maximumGasCostWei']) decimal(e[key]); if (!Number.isSafeInteger(e.nonce) || e.nonce < 0 || !Number.isFinite(Date.parse(e.expiresAt)) || !/^0x[a-f0-9]{64}$/.test(e.unsignedHash) || !/^0x[a-f0-9]{64}$/.test(e.reviewedPolicyHash)) fail(); });
  steps.forEach((step, i) => { object(step); if (step.index !== i || ![...STATES,'prepared','signing-requested'].includes(step.state)) fail(); if (step.operationId !== undefined) text(step.operationId, 96); if (step.transactionHash !== undefined && !/^0x[a-fA-F0-9]{64}$/.test(step.transactionHash)) fail(); if (step.acknowledgement !== undefined && (typeof step.acknowledgement !== 'string' || !/^[\x20-\x7e]{1,256}$/.test(step.acknowledgement))) fail(); if (step.relayAttempted !== undefined && typeof step.relayAttempted !== 'boolean') fail(); if (step.blocker !== undefined) text(step.blocker, 1024); });
  for (const key of ['authorityComplete','activationReady','physicalQualified']) if (typeof value.readiness[key] !== 'boolean') fail();
  return value;
}
export const stateLabel = state => ({ 'awaiting-owner-approval': 'Awaiting owner approval / Approbation requise', prepared: 'Durable intent / Intention durable', 'signing-requested': 'Signing requested / Signature demandée', signed: 'Signed / Signée', submitted: 'Submitted / Envoyée', pending: 'Pending / En attente', finalized: 'Finalized / Finalisée', verified: 'Verified / Vérifiée', blocked: 'Blocked / Bloquée', 'recovery-required': 'Recovery required / Reprise requise' })[state] ?? 'Blocked / Bloquée';
export function nextStep(status) { return status.steps.find(step => step.state !== 'verified'); }
