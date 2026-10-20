import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { canonical, parseStrict, publicOnly } from '../../site/assets/successor/safe.mjs';
import { createTransformationWorkDraft, inspectTransformationWorkDraft, inspectTransformationWorkRequest } from './transformational-work-request.mjs';

const hash = value => createHash('sha256').update(value).digest('hex');
const digest = value => 'sha256:' + hash(value);
const nativeDigest = (domain, value) => hash('successor-omega/v1:' + domain + '\0' + canonical(value));
function campaign(change = () => {}) {
  const request = {
    schema:'transformational-intelligence/v1', campaign_id:'public-argument-pilot', revision:1,
    charter:{ schema:'intent-charter/v1', purpose:'Produce a source-grounded fixed-length summary',
      population:'Public open-source documentation', outcomes:['Faithful summary'], constraints:['Keep the requested summary format'],
      permitted_actions:['read-public-fixture', 'write-local-artifact'], publicOnly:true,
      budgets:{ search_units:10, execution_units:10, money_minor:0, USDCBaseUnits:'25000000', AGIALPHABaseUnits:'0' }, payment_route:'USDC' },
    formulation:{ schema:'formulation/v1', representation:'audited-argument-map', assumptions:['Post-draft checking may lose dependency information'] },
    evaluation:{ instrument:{ schema:'evaluation-instrument/v1', measurement:'fixed-summary-structural-coverage', calibration:'missing' }, epoch:1, status:'frozen' },
    transformation:{ purpose:'Preserve the original summary purpose', restriction:'Draft before representing dependencies',
      provenance:'Inherited workflow', proposed_change:'Audit an argument representation before compression',
      construction:'local-argument-map', realization:'same-length-summary', prerequisites:['Public source with fixed edition'],
      fallback:'Keep the incumbent summary', outcome_bridge:'Compare both summaries under the unchanged instrument',
      falsifier:'Representation extraction errors outweigh fewer omissions', comparisons:['fixed-frame', 'unrestricted'],
      confirmation:'Frozen fresh-source comparison', reuse_conditions:['Traceable support'], failure_cases:['Ambiguous source'], retirement:['Domain drift'] },
    bindings:{ code:hash('frozen-code'), model:hash('deterministic-fixture'), config:hash('public-input-only'), evidence:hash('frozen-source') },
    phase:'frozen', authorization:{ scope:'local-bounded', binding:hash('local-campaign-authorization'), authority_expansion:false },
    execution:{ status:'not-started', artifacts:[] }, review:{ status:'pending-independent-review', independent:false },
    settlement:{ route:'USDC', status:'unfunded', transaction_prepared:false },
  };
  change(request);
  for (const field of ['charter', 'formulation', 'transformation', 'bindings']) request[field + '_digest'] = nativeDigest('ti-' + field, request[field]);
  if (request.evaluation.instrument_digest === undefined) request.evaluation.instrument_digest = nativeDigest('ti-instrument', request.evaluation.instrument);
  return request;
}
// This policy double is deliberately labeled. Native mixed-repository validation is separate evidence.
const inspectWorkRequest = async raw => parseStrict(raw);
const options = request => ({ budgetUSDC:'25.00', createdAt:'2026-10-19T15:00:00.000Z',
  expectedBindingsDigest:request.bindings_digest, inspectWorkRequest });
const resign = value => { const { sha256, ...body } = value; return canonical({ ...body, sha256:digest(canonical(body)) }); };

test('valid campaign creates a fully bound, inert USDC6 proposal and preserves exact original bytes', async () => {
  const request = campaign(), requestRaw = JSON.stringify(request, null, 2);
  const raw = await createTransformationWorkDraft(requestRaw, options(request));
  const value = await inspectTransformationWorkDraft(raw, options(request));
  assert.equal(value.original, requestRaw);
  assert.equal(value.bindings.requestRawSha256, digest(requestRaw));
  assert.equal(value.bindings.charterDigest, request.charter_digest);
  assert.equal(value.bindings.instrumentDigest, request.evaluation.instrument_digest);
  assert.equal(value.bindings.measurementEpoch, 1);
  assert.equal(value.bindings.adapterSha256, digest(readFileSync(new URL('./transformational-work-request.mjs', import.meta.url))));
  assert.equal(value.planning.amountBaseUnits, '25000000');
  assert.equal(value.authorizedCapBaseUnits, '25000000');
  assert.deepEqual([value.route.asset, value.route.decimals, value.route.deployment], ['USDC', 6, null]);
  assert.equal(value.jobSpecification.sha256, digest(value.jobSpecification.raw));
  assert.equal(value.authority, 'none');
  for (const field of ['executionApproved', 'productionApproved', 'settlementApproved', 'independentProof', 'trustedComputerExecution']) assert.equal(value[field], false);
  for (const field of ['transaction', 'specURI', 'durationSeconds', 'details']) assert.equal(value.commissioning[field], null);
});

test('free starting campaign and other payment routes cannot authorize a positive USDC proposal', async () => {
  for (const route of ['none', 'AGIALPHA']) {
    const request = campaign(x => { x.charter.payment_route = route; x.settlement.route = route; });
    await assert.rejects(createTransformationWorkDraft(canonical(request), options(request)), /TRANSFORMATION_USDC_ROUTE/);
  }
  const request = campaign(x => { x.charter.budgets.USDCBaseUnits = '0'; });
  await assert.rejects(createTransformationWorkDraft(canonical(request), options(request)), /TRANSFORMATION_USDC_CAP/);
});

test('free native campaign inspection preserves purpose and grants no paid-work permission', async () => {
  const request = campaign(x => { x.charter.payment_route = 'none'; x.settlement.route = 'none';
    x.charter.budgets.USDCBaseUnits = '0'; x.authorization.binding = null; });
  assert.deepEqual(await inspectTransformationWorkRequest(canonical(request), options(request)), request);
  request.revision = 0;
  assert.deepEqual(await inspectTransformationWorkRequest(canonical(request), options(request)), request);
  await assert.rejects(createTransformationWorkDraft(canonical(request), options(request)), /TRANSFORMATION_USDC_ROUTE/);
});

test('USDC is separately supplied, exact and bounded by the charter without currency conversion', async () => {
  const request = campaign();
  for (const budgetUSDC of ['25.000001', '26'])
    await assert.rejects(createTransformationWorkDraft(canonical(request), { ...options(request), budgetUSDC }), /TRANSFORMATION_USDC_CAP/);
  for (const budgetUSDC of ['0', '00.1', '01', '1e6', '-1', '1.0000001', ' 1', '1.', 25, undefined])
    await assert.rejects(createTransformationWorkDraft(canonical(request), { ...options(request), budgetUSDC }), /TRANSFORMATION_DRAFT_USDC/);
  const minimum = await createTransformationWorkDraft(canonical(request), { ...options(request), budgetUSDC:'0.000001' });
  assert.equal(JSON.parse(minimum).planning.amountBaseUnits, '1');
  const maximum = campaign(x => { x.charter.budgets.USDCBaseUnits = ((1n << 128n) - 1n).toString(); });
  const maximumRaw = await createTransformationWorkDraft(canonical(maximum), { ...options(maximum), budgetUSDC:'340282366920938463463374607431768.211455' });
  assert.equal(JSON.parse(maximumRaw).planning.amountBaseUnits, ((1n << 128n) - 1n).toString());
  await assert.rejects(createTransformationWorkDraft(canonical(maximum), { ...options(maximum), budgetUSDC:'340282366920938463463374607431768.211456' }), /TRANSFORMATION_DRAFT_USDC/);
});

test('malformed or overwide authorized USDC caps fail closed', async () => {
  for (const cap of ['01', '-1', '1.5', '1e6', ' ', 25, undefined, (1n << 128n).toString()]) {
    const request = campaign(x => { x.charter.budgets.USDCBaseUnits = cap; });
    await assert.rejects(createTransformationWorkDraft(canonical(request), options(request)), /TRANSFORMATION_USDC_CAP|JSON/);
  }
});

test('native validator is mandatory and must return the exact parsed request', async () => {
  const request = campaign(), raw = canonical(request);
  await assert.rejects(createTransformationWorkDraft(raw, { ...options(request), inspectWorkRequest:undefined }), /TRANSFORMATION_INSPECTOR_REQUIRED/);
  for (const inspector of [async () => ({ accepted:true }), async () => campaign(x => { x.revision++; }), async () => { throw Error('NATIVE_REJECTED'); }])
    await assert.rejects(createTransformationWorkDraft(raw, { ...options(request), inspectWorkRequest:inspector }), /TRANSFORMATION_NATIVE_BINDING|NATIVE_REJECTED/);
});

test('charter, formulation, witness and runtime digest substitution is rejected before draft creation', async () => {
  for (const field of ['charter', 'formulation', 'transformation', 'bindings']) {
    const request = campaign(); request[field + '_digest'] = '0'.repeat(64);
    await assert.rejects(createTransformationWorkDraft(canonical(request), options(request)), /TRANSFORMATION_OBJECT_BINDING/);
  }
});

test('frozen code, model, configuration and evidence changes invalidate an earlier draft', async () => {
  const request = campaign(), raw = await createTransformationWorkDraft(canonical(request), options(request));
  for (const field of ['code', 'model', 'config', 'evidence']) {
    const updated = campaign(x => { x.bindings[field] = hash('new-' + field); });
    await assert.rejects(inspectTransformationWorkDraft(raw, options(updated)), /TRANSFORMATION_STALE_BINDINGS/);
  }
  await assert.rejects(inspectTransformationWorkDraft(raw, { inspectWorkRequest }), /TRANSFORMATION_EXPECTED_BINDINGS/);
});

test('all outer authority, currency, budget, epoch and identity edits reject even with recomputed checksum', async () => {
  const request = campaign(), raw = await createTransformationWorkDraft(canonical(request), options(request));
  for (const mutate of [x => { x.authority = 'execute'; }, x => { x.productionApproved = true; }, x => { x.settlementApproved = true; },
    x => { x.executionApproved = true; }, x => { x.independentProof = true; }, x => { x.route.asset = 'AGIALPHA'; },
    x => { x.route.decimals = 18; }, x => { x.route.deployment = '0x' + '1'.repeat(40); },
    x => { x.planning.reservedBaseUnits = '1'; }, x => { x.planning.amountBaseUnits = '1'; },
    x => { x.authorizedCapBaseUnits = '99999999'; }, x => { x.bindings.measurementEpoch++; },
    x => { x.bindings.authorizationBinding = '0'.repeat(64); }, x => { x.bindings.charterDigest = '0'.repeat(64); }, x => { x.bindings.adapterSha256 = 'sha256:' + '0'.repeat(64); },
    x => { x.commissioning.transaction = {}; }]) {
    const changed = JSON.parse(raw); mutate(changed);
    await assert.rejects(inspectTransformationWorkDraft(resign(changed), options(request)), /TRANSFORMATION_DRAFT_INTEGRITY/);
  }
});

test('decoded private inputs and ambiguous duplicate fields are refused before native validation', async () => {
  const request = campaign(x => { x.charter.purpose = 'Read operator@example.invalid'; });
  const raw = canonical(request).replace('@', '\\u0040');
  await assert.rejects(createTransformationWorkDraft(raw, options(request)), /PRIVATE_INPUT/);
  let invoked = false;
  await assert.rejects(createTransformationWorkDraft('{"schema":"x","schema":"y"}', {
    ...options(campaign()), inspectWorkRequest:async () => { invoked = true; },
  }), /DUPLICATE_KEY/);
  assert.equal(invoked, false);
  for (const key of ['api_key', 'private-key', 'accessToken', 'Password', 'client.secret', 'signing_key',
    'token', 'authorization', 'id_token', 'session_token', 'api_secret', 'secret_key', 'credential',
    'x-api-key', 'x-auth-token', 'proxy-authorization', 'aws_secret_access_key', 'httpAuthorization', 'providerBearerToken', 'authorizationBinding',
    'auth', 'authentication', 'x-auth', 'providerAuthentication']) {
    const credential = campaign(x => { x.bindings.configuration = { nested:[{ [key]:'synthetic-fixture-only' }] }; });
    await assert.rejects(createTransformationWorkDraft(canonical(credential), {
      ...options(credential), inspectWorkRequest:async () => { invoked = true; },
    }), /TRANSFORMATION_PRIVATE_FIELD/);
    assert.equal(invoked, false);
  }
  const bearer = campaign(x => { x.bindings.configuration = { notes:'Bearer synthetic-fixture-only' }; });
  await assert.rejects(inspectTransformationWorkRequest(canonical(bearer), {
    ...options(bearer), inspectWorkRequest:async () => { invoked = true; },
  }), /TRANSFORMATION_PRIVATE_FIELD/);
  assert.equal(invoked, false);
  const forgedDraft = campaign(x => {
    x.schema = 'agijobmanager/transformational-work-draft/v1';
    x.bindings.authorizationBinding = 'a'.repeat(64);
  });
  await assert.rejects(inspectTransformationWorkRequest(canonical(forgedDraft), {
    ...options(forgedDraft), inspectWorkRequest:async raw => { invoked = true; return parseStrict(raw); },
  }), /TRANSFORMATION_PRIVATE_FIELD/);
  assert.equal(invoked, false);
});

test('public provenance is credential-free HTTPS DNS and refuses private or ambiguous URL forms before native inspection', async () => {
  let invoked = false;
  for (const url of ['http://example.invalid/paper', 'https://localhost/paper', 'https://service.local/paper',
    'https://service.internal/paper', 'https://10.0.0.1/paper', 'https://172.16.0.1/paper', 'https://192.168.0.1/paper',
    'https://127.0.0.1/paper', 'https://0177.0.0.1/paper', 'https://2130706433/paper', 'https://[::1]/paper',
    'https://[::ffff:127.0.0.1]/paper', 'https://example.invalid:8443/paper', 'https://user:synthetic@example.invalid/paper',
    'https://example.invalid/paper?refresh_token=synthetic-fixture', 'https://example.invalid/paper?api%5fsecret=synthetic-fixture',
    'https://example.invalid/paper?X-Amz-Credential=synthetic-fixture', 'https://example.invalid/paper#access_token=synthetic-fixture',
    'https:\\\\127.0.0.1/paper', 'https:\t//127.0.0.1/paper', 'ht\ttps://127.0.0.1/paper',
    'https:\n//10.0.0.1/paper', 'https:2130706433/paper', 'https:\\\\[::1]/paper',
    'https://example.invalid/paper?auth=synthetic-fixture', 'https://example.invalid/paper?authentication=synthetic-fixture',
    'ftp://127.0.0.1/private', 'file:///private/document', 'ws://127.0.0.1/socket', 's3://public-bucket/document',
    'data:text/plain,fixture', 'javascript:fixture()', '//127.0.0.1/private', '//github.com/MontrealAI', '\\\\127.0.0.1/private',
    '/\\127.0.0.1/private', '\\/127.0.0.1/private']) {
    const request = campaign(x => { x.charter.purpose = 'Inspect ' + url; });
    await assert.rejects(inspectTransformationWorkRequest(canonical(request), {
      ...options(request), inspectWorkRequest:async () => { invoked = true; },
    }), /PRIVATE_(?:URL|INPUT)/);
    assert.equal(invoked, false);
  }
  const request = campaign(x => { x.charter.purpose = 'Inspect https://github.com/MontrealAI/AGI-Alpha-Agent-v0?page=1'; });
  assert.deepEqual(await inspectTransformationWorkRequest(canonical(request), options(request)), request);
  const privateName = campaign(x => { x.bindings.configuration = { 'ftp://127.0.0.1/private':'fixture' }; });
  await assert.rejects(inspectTransformationWorkRequest(canonical(privateName), {
    ...options(privateName), inspectWorkRequest:async () => { invoked = true; },
  }), /TRANSFORMATION_PRIVATE_URL/);
  assert.equal(invoked, false);
});

test('ordinary colon labels and punctuated content digests retain exact text through inert inspection and draft recovery', async () => {
  for (const purpose of ['Phase:Plan', 'ratio:2', 'Source:https://github.com/MontrealAI/AGI-Alpha-Agent-v0',
    'Use sha256:' + hash('public-source') + ', then inspect the source.',
    'Retain (sha256:' + hash('public-source') + ').']) {
    const request = campaign(x => { x.charter.purpose = purpose;
      x.bindings.configuration = { 'metric:p95':'ratio:2' }; });
    assert.deepEqual(await inspectTransformationWorkRequest(canonical(request), options(request)), request);
    const raw = await createTransformationWorkDraft(canonical(request), options(request));
    assert.equal((await inspectTransformationWorkDraft(raw, options(request))).original, canonical(request));
  }
});

test('explicit URI shapes, known active schemes and URL-named fields retain strict public HTTPS admission', async () => {
  for (const [key, value] of [
    ['notes', 'Source:https://127.0.0.1/private'],
    ['notes', 'Source:https://example.invalid/?access_token=synthetic-fixture'],
    ['notes', 'unknown-protocol://example.invalid/item'],
    ['notes', 'unknown-protocol:opaque/path'],
    ['notes', 'unknown-protocol:opaque?query=value'],
    ['notes', 'blob:https://example.invalid/item'],
    ['notes', 'mailto:person@example.invalid'],
    ['source_url', 'unknown-protocol:opaque'], ['sourceURI', 'Phase:Plan'],
    ['href', 'https://example.invalid/item another-value'],
    ['serviceEndpoint', 'https://127.0.0.1/item'],
    ['provenanceURLs', ['unknown-protocol:opaque']],
    ['notes', 'sha256:invalid'],
  ]) {
    let invoked = false;
    const request = campaign(x => { x.bindings.configuration = { [key]:value }; });
    await assert.rejects(inspectTransformationWorkRequest(canonical(request), {
      ...options(request), inspectWorkRequest:async () => { invoked = true; },
    }), /PRIVATE_(?:URL|INPUT)/);
    assert.equal(invoked, false);
  }
  const request = campaign(x => { x.bindings.configuration = {
    source_url:'https://github.com/MontrealAI/AGI-Alpha-Agent-v0',
    provenanceURLs:['https://github.com/MontrealAI/AGIJobManager'],
    sourceURI:'sha256:' + hash('public-source'),
  }; });
  assert.deepEqual(await inspectTransformationWorkRequest(canonical(request), options(request)), request);
});

test('prose control separators keep independent URL references and benign multiline labels separate', async () => {
  for (const separator of ['\t', '\r', '\n', '\r\n']) {
    let invoked = false;
    const request = campaign(x => { x.charter.purpose = 'https://example.invalid/' + separator + 'file:///fixture'; });
    await assert.rejects(inspectTransformationWorkRequest(canonical(request), {
      ...options(request), inspectWorkRequest:async () => { invoked = true; },
    }), /TRANSFORMATION_PRIVATE_URL/);
    assert.equal(invoked, false);
  }
  const request = campaign(x => { x.charter.purpose = 'Phase:Plan\nSource:\thttps://github.com/MontrealAI'; });
  assert.deepEqual(await inspectTransformationWorkRequest(canonical(request), options(request)), request);
  const raw = await createTransformationWorkDraft(canonical(request), options(request));
  assert.equal((await inspectTransformationWorkDraft(raw, options(request))).original, canonical(request));
  const changed = JSON.parse(raw);
  changed.original = canonical(campaign(x => { x.charter.purpose = 'https://example.invalid/\nfile:///fixture'; }));
  let invoked = false;
  await assert.rejects(inspectTransformationWorkDraft(resign(changed), {
    ...options(request), inspectWorkRequest:async () => { invoked = true; },
  }), /TRANSFORMATION_PRIVATE_URL/);
  assert.equal(invoked, false);
});

test('large valid generated drafts reopen under their declared bound while the default public screen stays bounded', async () => {
  const request = campaign(x => { x.charter.purpose = '"'.repeat(1_899_000); });
  const requestRaw = canonical(request);
  assert.ok(Buffer.byteLength(requestRaw) < 4_000_000);
  const raw = await createTransformationWorkDraft(requestRaw, options(request));
  assert.ok(Buffer.byteLength(raw) > 4_000_000 && Buffer.byteLength(raw) < 8_388_608);
  const value = await inspectTransformationWorkDraft(raw, options(request));
  assert.equal(value.original, requestRaw);
  assert.equal(value.bindings.requestRawSha256, digest(requestRaw));
  assert.throws(() => publicOnly('x'.repeat(4_000_001)), /TEXT/);
  await assert.rejects(inspectTransformationWorkDraft('x'.repeat(8_388_609), options(request)), /TRANSFORMATION_DRAFT_SIZE/);
});

test('malformed evidence epoch, authority scope and settlement declarations fail closed', async () => {
  for (const mutate of [x => { x.evaluation.epoch = 0; }, x => { x.evaluation.instrument_digest = 'missing'; },
    x => { x.authorization.authority_expansion = true; }, x => { x.authorization.scope = 'mainnet'; },
    x => { x.settlement.status = 'funded'; }, x => { x.settlement.transaction_prepared = true; },
    x => { x.charter.publicOnly = false; }, x => { x.review.independent = true; }]) {
    const request = campaign(mutate);
    await assert.rejects(createTransformationWorkDraft(canonical(request), options(request)), /TRANSFORMATION_/);
  }
});

test('input bounds, canonical clock and repeated inspection have deterministic recovery', async () => {
  const request = campaign(), raw = await createTransformationWorkDraft(canonical(request), options(request));
  assert.deepEqual(await inspectTransformationWorkDraft(raw, options(request)), await inspectTransformationWorkDraft(raw, options(request)));
  await assert.rejects(createTransformationWorkDraft(' '.repeat(4_000_001), options(request)), /TRANSFORMATION_DRAFT_SIZE/);
  await assert.rejects(createTransformationWorkDraft(canonical(request), { ...options(request), createdAt:'2026-10-19' }), /TRANSFORMATION_DRAFT_CLOCK/);
  await assert.rejects(inspectTransformationWorkDraft(raw + '\n', options(request)), /TRANSFORMATION_DRAFT_INTEGRITY/);
});


test('ordinary punctuation-separated public references preserve exact prose and HTTPS authorities', async () => {
  for (const prose of [
    'Sources: https://docs.example/one,https://reference.example/two',
    'Source: https://docs.example/Phase:Plan?edition=1',
    'Source: https://docs.example/Phase:Plan%20Notes',
    'Source: https://docs.example/edition?chapter=Phase:Plan/overview',
    'Source: https://docs.example/edition?chapter=Phase:Plan@Overview',
    'Sources (https://docs.example/one);https://reference.example/two',
    'Phase:Plan; status:ready. https://docs.example:443/one?chapter=Phase:Plan',
    'Public edition: https:docs.example:443/one,https://reference.example/two',
    'Phase:Plan\nReview:Ready https://docs.example/one;\thttps://reference.example/two',
  ]) {
    const request = campaign(value => { value.transformation.provenance = prose;
      value.transformation.reference_url = 'https://docs.example:443/edition?phase=Plan:Ready/overview'; });
    const original = canonical(request);
    const inspected = await inspectTransformationWorkRequest(original, options(request));
    assert.equal(inspected.transformation.provenance, prose);
    assert.equal(inspected.transformation.reference_url, request.transformation.reference_url);
    const draft = await createTransformationWorkDraft(original, options(request));
    assert.equal((await inspectTransformationWorkDraft(draft, options(request))).original, original);
  }
});
