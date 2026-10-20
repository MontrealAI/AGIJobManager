// SPDX-License-Identifier: MIT
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { isIP } from 'node:net';
import { canonical, keys, parseStrict, publicOnly } from '../../site/assets/successor/safe.mjs';

export const TRANSFORMATION_WORK_DRAFT_SCHEMA = 'agijobmanager/transformational-work-draft/v1';
const MAX_REQUEST = 4_000_000, MAX_DRAFT = 8_388_608;
const sha = value => createHash('sha256').update(value).digest('hex');
const digest = value => 'sha256:' + sha(value);
const adapterSha256 = digest(readFileSync(new URL(import.meta.url)));
const dataPolicySha256 = digest(readFileSync(new URL('../../site/assets/successor/safe.mjs', import.meta.url)));
const route = Object.freeze({ backend:'agijobmanager', asset:'USDC', decimals:6, chainId:1,
  token:'0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', deployment:null });
const need = (condition, code) => { if (!condition) throw Object.assign(Error(code), { code }); };
const same = (a, b) => canonical(a) === canonical(b);
const isDigest = value => typeof value === 'string' && /^[0-9a-f]{64}$/.test(value);
const nativeDigest = (domain, value) => sha('successor-omega/v1:' + domain + '\0' + canonical(value));
const credentialKeys = new Set(['password', 'passwd', 'apikey', 'privatekey', 'seedphrase', 'accesstoken',
  'refreshtoken', 'bearertoken', 'authtoken', 'clientsecret', 'signingkey', 'secret', 'credentials',
  'token', 'authorization', 'auth', 'authentication', 'idtoken', 'sessiontoken', 'apisecret', 'secretkey', 'credential']);
const normalizedKey = key => key.toLowerCase().replace(/[^a-z0-9]/g, '');
function credentialKey(key) {
  const name = normalizedKey(key);
  return credentialKeys.has(name) || /(?:password|passwd|apikey|privatekey|seedphrase|authentication|authorization|clientsecret|signingkey|secret|credential)/.test(name) || name.endsWith('token') || name.endsWith('auth');
}
// Preserve ordinary HTTPS authorities while separating recognized scheme
// starts in a second screening view. The original view is still checked too.
function separatedSchemeReferences(value) {
  const authorities = Array.from(value.matchAll(/(?<![a-z0-9+.-])https:[\/\\]*[^\/\\?#\s"<>]*/gi),
    match => [match.index + 6, match.index + match[0].length]);
  let authority = 0;
  return value.replace(/(?<![a-z0-9+.-])[a-z][a-z0-9+.-]*:/gi, (scheme, offset) => {
    while (authority < authorities.length && authorities[authority][1] <= offset) authority++;
    const span = authorities[authority];
    const following = value[offset + scheme.length];
    const explicit = /^(?:https?|file|ftps?|wss?|s3|gs|ipfs|ipns|data|javascript|vbscript|blob|about|mailto|tel|sms|ssh|git|git\+ssh|nfs|smb|ldaps?|chrome|chrome-extension|moz-extension|intent|market|news|nntp|rtsp|urn|sha256):$/i.test(scheme)
      || following === '/' || following === '\\';
    // Ordinary colon-bearing HTTPS path/query text remains part of its URL.
    const separate = explicit || offset > 0 && ',;()[]{}!'.includes(value[offset - 1]);
    return !separate || span && offset >= span[0] && offset < span[1] ? scheme : ' ' + scheme;
  });
}
function publicUrls(value, urlField = false) {
  const normalized = value.replace(/[\t\r\n]/g, ' ');
  // A prose label such as Phase:Plan is not a URL. Recognize explicit URI
  // structure and known schemes; URL fields require HTTPS or an exact digest.
  const referencesIn = text => Array.from(text.matchAll(/(?<![a-z0-9+.-])(?:(?:https?|file|ftps?|wss?|s3|gs|ipfs|ipns|data|javascript|vbscript|blob|about|mailto|tel|sms|ssh|git|git\+ssh|nfs|smb|ldaps?|chrome|chrome-extension|moz-extension|intent|market|news|nntp|rtsp|urn|sha256):[^\s"<>]+|[a-z][a-z0-9+.-]*:[\/\\]+[^\s"<>]*|[a-z][a-z0-9+.-]*:[^:\s"<>]*[/?#@%][^:\s"<>]*|[\/\\]{2}[^\s"<>]+)/gi), match => match[0]);
  const references = (urlField && normalized ? [normalized] : referencesIn(normalized))
    .concat(referencesIn(separatedSchemeReferences(normalized)));
  for (const reference of references) {
    if ((urlField ? /^sha256:[a-f0-9]{64}$/i : /^sha256:[a-f0-9]{64}[,.;:!?)\]]*$/i).test(reference)) continue;
    need(/^https:/i.test(reference) && !/[\s"<>]/.test(reference), 'TRANSFORMATION_PRIVATE_URL');
    let url;
    try { url = new URL(reference); } catch { need(false, 'TRANSFORMATION_PRIVATE_URL'); }
    const host = url.hostname.replace(/^\[|\]$/g, '');
    need(url.protocol === 'https:' && !url.username && !url.password && !url.port && !url.hash && !isIP(host)
      && host.includes('.') && !/(?:^|\.)(?:localhost|local|internal|lan|home)$/.test(host)
      && host.length <= 253 && host.split('.').every(label => /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label)),
    'TRANSFORMATION_PRIVATE_URL');
    for (const [key] of url.searchParams) need(!credentialKey(key)
      && !/^(?:key|sig|signature|xamz|xgoog)/.test(normalizedKey(key)), 'TRANSFORMATION_PRIVATE_URL');
  }
}
function rejectCredentialFields(value, path = [], draft = false, urlField = false) {
  if (typeof value === 'string') {
    if (draft && path.length === 1 && path[0] === 'original') {
      read(value, MAX_REQUEST); return;
    }
    publicOnly(value);
    need(!/\bBearer\s+\S{6,}/i.test(value), 'TRANSFORMATION_PRIVATE_FIELD');
    publicUrls(value, urlField); return;
  }
  if (value === null || typeof value !== 'object') return;
  for (const [key, child] of Object.entries(value)) {
    publicOnly(key);
    publicUrls(key);
    const inertAuthorization = path.length === 0 && key === 'authorization' && child && typeof child === 'object'
      && !Array.isArray(child) && Object.keys(child).sort().join('|') === 'authority_expansion|binding|scope'
      && child.scope === 'local-bounded' && child.authority_expansion === false && (child.binding === null || isDigest(child.binding));
    const publicCurrencyToken = path.length === 1 && path[0] === 'route' && key === 'token' && child === route.token;
    const publicAuthorizationDigest = draft && path.length === 1
      && path[0] === 'bindings' && key === 'authorizationBinding' && (child === null || isDigest(child));
    need(!credentialKey(key) || child === null || child === '' || inertAuthorization || publicCurrencyToken || publicAuthorizationDigest,
      'TRANSFORMATION_PRIVATE_FIELD');
    rejectCredentialFields(child, [...path, key], draft,
      urlField || /(?:urls?|uris?|hrefs?|endpoints?)$/.test(normalizedKey(key)));
  }
}
function read(raw, maximum, draft = false) {
  need(typeof raw === 'string' && Buffer.byteLength(raw, 'utf8') <= maximum, 'TRANSFORMATION_DRAFT_SIZE');
  const value = parseStrict(raw, maximum);
  rejectCredentialFields(value, [], draft);
  return value;
}
function baseUnits(value, code) {
  need(typeof value === 'string' && /^(?:0|[1-9][0-9]{0,38})$/.test(value), code);
  const units = BigInt(value);
  need(units <= (1n << 128n) - 1n, code);
  return units;
}
function proposedBudget(value) {
  need(typeof value === 'string' && /^(?:0|[1-9][0-9]{0,32})(?:\.[0-9]{1,6})?$/.test(value), 'TRANSFORMATION_DRAFT_USDC');
  const [whole, fractional = ''] = value.split('.');
  const units = baseUnits((BigInt(whole) * 1_000_000n + BigInt(fractional.padEnd(6, '0'))).toString(), 'TRANSFORMATION_DRAFT_USDC');
  need(units > 0n, 'TRANSFORMATION_DRAFT_USDC');
  return { budgetUSDC:value, amountBaseUnits:units.toString(), decimals:6,
    reservedBaseUnits:'0', status:'unfunded-proposal' };
}

/** Installed native validation is mandatory; this inspection grants no authority. */
export async function inspectTransformationWorkRequest(requestRaw, { expectedBindingsDigest, inspectWorkRequest } = {}) {
  const request = read(requestRaw, MAX_REQUEST);
  need(typeof inspectWorkRequest === 'function', 'TRANSFORMATION_INSPECTOR_REQUIRED');
  need(isDigest(expectedBindingsDigest), 'TRANSFORMATION_EXPECTED_BINDINGS');
  const inspected = read(canonical(await inspectWorkRequest(requestRaw)), MAX_REQUEST);
  need(same(inspected, request), 'TRANSFORMATION_NATIVE_BINDING');
  need(request.schema === 'transformational-intelligence/v1', 'TRANSFORMATION_SCHEMA');
  need(typeof request.campaign_id === 'string' && request.campaign_id.trim().length > 0
    && Number.isSafeInteger(request.revision) && request.revision >= 0, 'TRANSFORMATION_IDENTITY');
  need(request.charter?.schema === 'intent-charter/v1' && request.charter.publicOnly === true,
    'TRANSFORMATION_PUBLIC_CHARTER');
  need(['none', 'USDC', 'AGIALPHA'].includes(request.charter.payment_route)
    && request.settlement?.route === request.charter.payment_route, 'TRANSFORMATION_USDC_ROUTE');
  need(request.settlement.status === 'unfunded' && request.settlement.transaction_prepared === false,
    'TRANSFORMATION_SETTLEMENT_STATE');
  for (const field of ['charter', 'formulation', 'transformation', 'bindings'])
    need(request[field] && isDigest(request[field + '_digest'])
      && request[field + '_digest'] === nativeDigest('ti-' + field, request[field]), 'TRANSFORMATION_OBJECT_BINDING');
  need(request.bindings_digest === expectedBindingsDigest, 'TRANSFORMATION_STALE_BINDINGS');
  need(isDigest(request.evaluation?.instrument_digest) && Number.isSafeInteger(request.evaluation.epoch)
    && request.evaluation.epoch >= 1 && request.evaluation.instrument
    && request.evaluation.instrument_digest === nativeDigest('ti-instrument', request.evaluation.instrument), 'TRANSFORMATION_EVALUATION');
  need(request.authorization?.scope === 'local-bounded' && request.authorization.authority_expansion === false
    && (request.authorization.binding === null || isDigest(request.authorization.binding)), 'TRANSFORMATION_AUTHORIZATION_SCOPE');
  need(request.review?.independent === false, 'TRANSFORMATION_REVIEW_AUTHORITY');
  baseUnits(request.charter.budgets?.USDCBaseUnits, 'TRANSFORMATION_USDC_CAP');
  return request;
}

/** Prepare only an unfunded USDC proposal under a separately authorized nonzero cap. */
export async function createTransformationWorkDraft(requestRaw, {
  budgetUSDC, createdAt, expectedBindingsDigest, inspectWorkRequest,
} = {}) {
  const request = await inspectTransformationWorkRequest(requestRaw, { expectedBindingsDigest, inspectWorkRequest });
  need(request.charter.payment_route === 'USDC', 'TRANSFORMATION_USDC_ROUTE');
  need(typeof createdAt === 'string' && Number.isFinite(Date.parse(createdAt))
    && new Date(createdAt).toISOString() === createdAt, 'TRANSFORMATION_DRAFT_CLOCK');
  const planning = proposedBudget(budgetUSDC);
  const cap = baseUnits(request.charter.budgets?.USDCBaseUnits, 'TRANSFORMATION_USDC_CAP');
  need(cap > 0n && BigInt(planning.amountBaseUnits) <= cap, 'TRANSFORMATION_USDC_CAP');
  const bindings = { campaignId:request.campaign_id, revision:request.revision,
    requestRawSha256:digest(requestRaw), charterDigest:request.charter_digest,
    formulationDigest:request.formulation_digest, transformationDigest:request.transformation_digest,
    instrumentDigest:request.evaluation.instrument_digest, measurementEpoch:request.evaluation.epoch,
    runtimeBindingsDigest:request.bindings_digest, authorizationBinding:request.authorization.binding,
    adapterSha256, dataPolicySha256 };
  const specification = { schema:'agijobmanager/transformational-work-specification/v1', bindings,
    inputPolicy:'public-nonpersonal-only', requiredReview:'independent-review-required', authority:'none' };
  const specificationRaw = canonical(specification);
  const body = { schema:TRANSFORMATION_WORK_DRAFT_SCHEMA, createdAt, route, original:requestRaw, bindings, planning,
    authorizedCapBaseUnits:cap.toString(),
    jobSpecification:{ raw:specificationRaw, sha256:digest(specificationRaw), uri:null },
    commissioning:{ method:'createJob(string,uint256,uint256,string)', payoutBaseUnits:planning.amountBaseUnits,
      specURI:null, durationSeconds:null, details:null, transaction:null, state:'requires-deployment-and-terms-selection' },
    provenance:'untrusted-campaign-revalidated', authority:'none', review:'independent-review-required',
    independentProof:false, executionApproved:false, productionApproved:false, settlementApproved:false,
    settlement:'not-connected', trustedComputerExecution:false };
  const raw = canonical({ ...body, sha256:digest(canonical(body)) });
  need(Buffer.byteLength(raw, 'utf8') <= MAX_DRAFT, 'TRANSFORMATION_DRAFT_SIZE');
  return raw;
}

export async function inspectTransformationWorkDraft(raw, options = {}) {
  const value = read(raw, MAX_DRAFT, true);
  keys(value.planning, ['budgetUSDC', 'amountBaseUnits', 'decimals', 'reservedBaseUnits', 'status'], 'TRANSFORMATION_DRAFT_PLANNING');
  const rebuilt = await createTransformationWorkDraft(value.original, { ...options,
    budgetUSDC:value.planning.budgetUSDC, createdAt:value.createdAt });
  need(raw === rebuilt, 'TRANSFORMATION_DRAFT_INTEGRITY');
  return value;
}
