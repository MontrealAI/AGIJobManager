'use strict';
// Signature-verified input qualification. Transaction runners must supply verified
// observations and an atomic, durable portfolio reservation at their own boundary.
const crypto = require('node:crypto');
const fs = require('node:fs');
const { lifecycle, shape, text, uint, money, requireThat: ok } = require('./lifecycle.cjs');
const { formatUSDC } = require('../lib/usdc.js');
const { validateCalibration, validateCalibrationPolicy } = require('./calibration.cjs');
function canonical(x) {
  if (x === null || typeof x !== 'object') return JSON.stringify(x);
  if (Array.isArray(x)) return '[' + x.map(canonical).join(',') + ']';
  return '{' + Object.keys(x).sort().map(k => JSON.stringify(k) + ':' + canonical(x[k])).join(',') + '}';
}
const digest = x => crypto.createHash('sha256').update(canonical(x)).digest('hex');
const address = x => typeof x === 'string' && /^0x[0-9a-f]{40}$/.test(x) && !/^0x0{40}$/.test(x);
const hash = x => typeof x === 'string' && /^[0-9a-f]{64}$/.test(x);
const amount = (x, name) => { ok(typeof x === 'string' && /^(0|[1-9][0-9]{0,77})$/.test(x), name); return BigInt(x); };
function validatePolicy(p) {
  shape(p, [...([6,7].includes(p?.schemaVersion) ? ['reviewPayment'] : []),...([2,4,6].includes(p?.schemaVersion) ? ['maxPreparationAttempts'] : []),...([3,5,7].includes(p?.schemaVersion) ? ['capacity'] : []),...([4,5,6,7].includes(p?.schemaVersion) ? ['calibration'] : []),'schemaVersion','epoch','chainId','manager','wallet','role','trustedKeys','classes','maxPacketAgeSeconds','maxEvidenceAgeSeconds','minimumSamples','minimumHorizonDays','limits','maxOpenExposureUSDC','maxEpochCostUSDC','maxOpenJobs','maxGasWeiPerJob'], 'policy');
  ok([1,2,3,4,5,6,7].includes(p.schemaVersion), 'POLICY_VERSION');
  if([2,4,6].includes(p.schemaVersion)) uint(p.maxPreparationAttempts, 1, 100, 'preparation attempts');
  if([3,5,7].includes(p.schemaVersion)) {
    shape(p.capacity, ['allocationId','agentSlots','reviewerSlots','providerUnits'], 'capacity policy');
    text(p.capacity.allocationId, 'allocation');
    for(const k of ['agentSlots','reviewerSlots','providerUnits']) uint(p.capacity[k], 1, 1000000000, k);
  }
  if([6,7].includes(p.schemaVersion)) ok(['retainer','operator-budget'].includes(p.reviewPayment),'REVIEW_PAYMENT_POLICY');
  text(p.epoch, 'epoch');
  uint(p.chainId, 1, Number.MAX_SAFE_INTEGER, 'chainId'); ok(address(p.manager) && address(p.wallet), 'POLICY_ADDRESS');
  ok([3,5,7].includes(p.schemaVersion) ? p.role === 'employer' : ['agent','reviewer'].includes(p.role), 'POLICY_ROLE');
  ok(p.trustedKeys && !Array.isArray(p.trustedKeys) && Object.keys(p.trustedKeys).length > 0 && Object.keys(p.trustedKeys).length <= 8, 'POLICY_KEYS');
  for (const [id, pem] of Object.entries(p.trustedKeys)) { text(id, 'key ID'); ok(typeof pem === 'string' && pem.length < 4096 && crypto.createPublicKey(pem).asymmetricKeyType === 'ed25519', 'ED25519_REQUIRED'); }
  ok(Array.isArray(p.classes) && p.classes.length > 0 && p.classes.length <= 100, 'POLICY_CLASSES'); p.classes.forEach(x => text(x, 'class'));
  uint(p.maxPacketAgeSeconds, 1, 3600, 'packet age'); uint(p.maxEvidenceAgeSeconds, 1, 2592000, 'evidence age'); uint(p.minimumSamples, 1, 1000000000, 'samples'); uint(p.minimumHorizonDays, 1, 3650, 'horizon');
  shape(p.limits, ['employer','agent','reviewer'], 'limits');
  for (const l of Object.values(p.limits)) { shape(l, ['minimumExpectedNetUSDC','maximumScenarioLossUSDC'], 'limit'); money(l.minimumExpectedNetUSDC, 'minimum'); money(l.maximumScenarioLossUSDC, 'loss'); }
  money(p.maxOpenExposureUSDC, 'exposure'); money(p.maxEpochCostUSDC, 'cost'); uint(p.maxOpenJobs, 1, 100, 'open jobs'); ok(amount(p.maxGasWeiPerJob, 'gas') > 0n, 'POSITIVE_GAS_BUDGET_REQUIRED');
  if([4,5,6,7].includes(p.schemaVersion)) validateCalibrationPolicy(p.calibration);
  return p;
}
function checkAdmission({ policy, envelope, observed, portfolio, evidenceReport, now = Math.floor(Date.now()/1000) }) {
  validatePolicy(policy); uint(now, 1, Number.MAX_SAFE_INTEGER, 'clock');
  shape(envelope, ['keyId','payload','signature'], 'envelope');
  ok(Object.hasOwn(policy.trustedKeys, envelope.keyId), 'UNTRUSTED_ISSUER');
  ok(typeof envelope.signature === 'string' && /^[A-Za-z0-9+/]{86}==$/.test(envelope.signature), 'INVALID_SIGNATURE_ENCODING');
  const key = crypto.createPublicKey(policy.trustedKeys[envelope.keyId]);
  ok(crypto.verify(null, Buffer.from(canonical(envelope.payload)), key, Buffer.from(envelope.signature,'base64')), 'INVALID_SIGNATURE');
  const p = envelope.payload;
  const funding = [3,5,7].includes(p?.schemaVersion), idKey = funding ? 'offerId' : 'jobId';
  shape(p, [...(p?.schemaVersion >= 2 ? ['commitment'] : []),...(funding ? ['capacity','valueEvidence'] : []),'schemaVersion','policyDigest',idKey,'participantId','jobClass','issuedAt','expiresAt','specURI','specSha256','evidence','identities','lifecycle','gasBudgetWei','ethPriceCeilingUSDC'], 'payload');
  ok(p.schemaVersion === policy.schemaVersion && p.policyDigest === digest(policy), 'POLICY_BINDING');
  if(funding) ok(hash(p.offerId), 'OFFER_ID');
  else ok(typeof p.jobId === 'string' && /^(0|[1-9][0-9]{0,77})$/.test(p.jobId) && BigInt(p.jobId) < 2n**256n, 'JOB_ID');
  text(p.participantId, 'participant');
  ok(policy.classes.includes(p.jobClass), 'UNQUALIFIED_CLASS'); text(p.specURI, 'spec URI'); ok(hash(p.specSha256), 'SPEC_HASH');
  uint(p.issuedAt, 1, now, 'issuedAt'); uint(p.expiresAt, now + 1, Number.MAX_SAFE_INTEGER, 'expiresAt');
  ok(now - p.issuedAt <= policy.maxPacketAgeSeconds && p.expiresAt - p.issuedAt <= policy.maxPacketAgeSeconds, 'STALE_PACKET');
  shape(p.evidence, ['reportSha256','measuredAt','sampleCount','qualification','costsIncludeFailuresAndOverhead'], 'evidence');
  ok(hash(p.evidence.reportSha256) && p.evidence.qualification === 'qualified' && p.evidence.costsIncludeFailuresAndOverhead === true, 'EVIDENCE_ATTESTATION_REQUIRED');
  uint(p.evidence.measuredAt, 1, now, 'measurement time'); uint(p.evidence.sampleCount, policy.minimumSamples, 1000000000, 'sample count');
  ok(now - p.evidence.measuredAt <= policy.maxEvidenceAgeSeconds, 'STALE_EVIDENCE');
  shape(observed, [...(p.schemaVersion >= 2 ? ['commitment'] : []),'chainId','manager','wallet',idKey,'specURI','specSha256','terms','observedAt'], 'observed');
  ok(observed.chainId === policy.chainId && observed.manager === policy.manager && observed.wallet === policy.wallet && observed[idKey] === p[idKey] && observed.specURI === p.specURI && observed.specSha256 === p.specSha256, 'OBSERVATION_BINDING');
  uint(observed.observedAt, now - 120, now, 'observation time');
  ok(canonical(observed.terms) === canonical(p.lifecycle.terms), 'ECONOMIC_TERMS_CHANGED');
  const input = JSON.parse(JSON.stringify(p.lifecycle));
  ok(input.horizonDays >= policy.minimumHorizonDays, 'HORIZON_TOO_SHORT');
  ok(Array.isArray(input.participants), 'PARTICIPANTS_REQUIRED');
  shape(p.identities, input.participants.map(x=>x.id), 'identities');
  const wallets = new Set(), controllers = new Set();
  for (const actor of input.participants) {
    const identity = p.identities[actor.id]; shape(identity, ['wallet','controllerId'], 'identity');
    ok(address(identity.wallet) && !wallets.has(identity.wallet) && hash(identity.controllerId) && !controllers.has(identity.controllerId), 'INDEPENDENT_PARTICIPANTS_REQUIRED');
    wallets.add(identity.wallet); controllers.add(identity.controllerId);
    ok(Object.hasOwn(policy.limits, actor.role), 'INVALID_ROLE');
    Object.assign(actor, policy.limits[actor.role]);
  }
  const me = input.participants.find(x=>x.id === p.participantId);
  ok(me && me.role === policy.role && p.identities[me.id].wallet === policy.wallet, 'PARTICIPANT_SCOPE');
  if([2,4,6].includes(p.schemaVersion)) {
    const c=p.commitment;
    shape(c, ['action','decision','completionURI','deliverySha256'], 'commitment');
    if(me.role === 'agent') ok(c.action === 'apply' && c.decision === null && c.completionURI === null && c.deliverySha256 === null, 'AGENT_COMMITMENT');
    else {
      ok(c.action === 'vote' && ['approve','reject'].includes(c.decision), 'REVIEWER_COMMITMENT');
      text(c.completionURI, 'completion URI'); ok(hash(c.deliverySha256), 'DELIVERY_HASH');
      ok(Array.isArray(input.cases) && input.cases.every(x=>x.ballots?.[me.id] === 'absent' || x.ballots?.[me.id] === c.decision), 'FIXED_REVIEWER_BALLOT_REQUIRED');
    }
    ok(canonical(observed.commitment) === canonical(c), 'COMMITMENT_CHANGED');
  }
  if(funding) {
    shape(p.commitment, ['action','durationSeconds','details'], 'funding commitment');
    ok(p.commitment.action === 'createJob', 'FUNDING_ACTION');
    ok(amount(p.commitment.durationSeconds, 'duration') > 0n && BigInt(p.commitment.durationSeconds) < 2n**256n, 'DURATION');
    text(p.commitment.details, 'details');
    ok(canonical(observed.commitment) === canonical(p.commitment), 'COMMITMENT_CHANGED');
    shape(p.capacity, ['allocationId','leaseId','expiresAt','agentSlots','reviewerSlots','providerUnits'], 'capacity lease');
    ok(p.capacity.allocationId === policy.capacity.allocationId && hash(p.capacity.leaseId), 'CAPACITY_SCOPE');
    uint(p.capacity.expiresAt, p.expiresAt, Number.MAX_SAFE_INTEGER, 'capacity expiry');
    for(const k of ['agentSlots','reviewerSlots','providerUnits']) uint(p.capacity[k], 1, policy.capacity[k], k);
    ok(p.capacity.reviewerSlots >= input.participants.filter(x=>x.role === 'reviewer').length, 'REVIEWER_CAPACITY');
    shape(p.valueEvidence, ['baselineSha256','outcomesSha256','measurementKind','sampleCount'], 'value evidence');
    ok(hash(p.valueEvidence.baselineSha256) && hash(p.valueEvidence.outcomesSha256) && p.valueEvidence.measurementKind === 'observed', 'MEASURED_VALUE_EVIDENCE_REQUIRED');
    uint(p.valueEvidence.sampleCount, policy.minimumSamples, 1000000000, 'value samples');
  }
  let calibration = null;
  if([4,5,6,7].includes(p.schemaVersion)) {
    ok(input.schemaVersion === ([6,7].includes(p.schemaVersion)&&policy.reviewPayment==='operator-budget'?1:2), 'REVIEW_PAYMENT_LIFECYCLE_REQUIRED');
    ok(typeof evidenceReport === 'string' && Buffer.byteLength(evidenceReport) <= 1048576, 'CALIBRATION_REPORT_REQUIRED');
    ok(crypto.createHash('sha256').update(evidenceReport).digest('hex') === p.evidence.reportSha256, 'CALIBRATION_REPORT_HASH');
    const report = JSON.parse(evidenceReport);
    ok(report.measuredAt === p.evidence.measuredAt, 'CALIBRATION_MEASUREMENT_BINDING');
    calibration = validateCalibration({model:input, report, policy:policy.calibration, jobClass:p.jobClass, now});
    ok(calibration.evaluationSamples === p.evidence.sampleCount, 'CALIBRATION_SAMPLE_BINDING');
    if(funding) ok(report.measurementKind === p.valueEvidence.measurementKind && report.measurementKind === 'observed', 'CALIBRATION_VALUE_PROVENANCE');
  }
  const result = lifecycle(input); ok(result.decision === 'WITHIN_SUPPLIED_LIMITS', 'ECONOMIC_LIMITS: ' + result.failures.join(' '));
  const self = result.participants[me.id], exposure = money(self.conservativeExposureUSDC, 'exposure'), cost = money(self.maximumCostUSDC, 'cost');
  const gas = amount(p.gasBudgetWei, 'gas budget'); ok(gas > 0n && gas <= amount(policy.maxGasWeiPerJob, 'policy gas budget'), 'GAS_BUDGET_LIMIT');
  const ethPrice = money(p.ethPriceCeilingUSDC, 'ETH price ceiling'); ok(ethPrice > 0n, 'ETH_PRICE_CEILING_REQUIRED');
  const gasUSDC = (gas * ethPrice + 10n**18n - 1n)/(10n**18n);
  ok(input.cases.every(x=>money(x.costsUSDC[me.id], 'case cost') >= gasUSDC), 'GAS_NOT_INCLUDED_IN_COSTS');
  shape(portfolio, [...(funding ? ['capacity'] : []),'openExposureUSDC','epochCostUSDC','openJobs'], 'portfolio');
  if(funding) {
    shape(portfolio.capacity, ['agentSlots','reviewerSlots','providerUnits'], 'portfolio capacity');
    for(const k of ['agentSlots','reviewerSlots','providerUnits']) {
      uint(portfolio.capacity[k], 0, policy.capacity[k], k);
      ok(portfolio.capacity[k]+p.capacity[k] <= policy.capacity[k], 'CAPACITY_LIMIT_'+k);
    }
  }
  uint(portfolio.openJobs, 0, 100, 'open jobs');
  ok(portfolio.openJobs + 1 <= policy.maxOpenJobs, 'OPEN_JOB_LIMIT');
  ok(money(portfolio.openExposureUSDC, 'open exposure') + exposure <= money(policy.maxOpenExposureUSDC,'exposure cap'), 'AGGREGATE_EXPOSURE_LIMIT');
  ok(money(portfolio.epochCostUSDC,'epoch cost') + cost <= money(policy.maxEpochCostUSDC,'cost cap'), 'EPOCH_COST_LIMIT');
  return { schemaVersion:p.schemaVersion, ...(calibration ? {calibration} : {}), ...(p.schemaVersion >= 2 ? {commitment:JSON.parse(JSON.stringify(p.commitment))} : {}), ...([2,4,6].includes(p.schemaVersion) ? {maxPreparationAttempts:policy.maxPreparationAttempts} : {}), ...(funding ? {capacity:JSON.parse(JSON.stringify(p.capacity))} : {}), decision:'QUALIFIED_UNDER_ATTESTED_INPUTS', packetDigest:digest(envelope), policyDigest:digest(policy), [idKey]:p[idKey], participantId:p.participantId, reserveExposureUSDC:formatUSDC(exposure), reserveCostUSDC:formatUSDC(cost), gasBudgetWei:gas.toString(), expiresAt:p.expiresAt, economics:result, authorization:'NONE — a runner must independently verify observations, reserve atomically and enforce signing limits.' };
}
function checkNewWork(input) {
  ok([6,7].includes(input?.policy?.schemaVersion) && input.policy.reviewPayment === 'operator-budget', 'NEW_WORK_REQUIRES_OPERATOR_BUDGET');
  return checkAdmission(input);
}
if (require.main === module) {
  try { const args=process.argv.slice(2); if(args.length===1 && args[0]==='--help') { console.log('Usage: economics:admission -- input.json\nInput: {policy,envelope,observed,portfolio,evidenceReport}. New work requires schema 6 (agent/reviewer) or 7 (employer), reviewPayment=operator-budget. evidenceReport is the exact UTF-8 calibration-report text. Offline verification; no signer or reservation.'); }
    else { ok(args.length===1,'Use --help or one input JSON file.'); const s=fs.statSync(args[0]);ok(s.isFile()&&s.size<=1048576,'Input must be a regular JSON file <=1 MiB.');const x=JSON.parse(fs.readFileSync(args[0],'utf8'));shape(x,[...([4,5,6,7].includes(x.policy?.schemaVersion)?['evidenceReport']:[]),'policy','envelope','observed','portfolio'],'input');console.log(JSON.stringify(checkNewWork(x),null,2)); }
  } catch(e) { console.error(String(e.message).replace(/[\u0000-\u001f\u007f-\u009f]/gu,' '));process.exitCode=1; }
}
module.exports={canonical,digest,validatePolicy,checkAdmission,checkNewWork};
