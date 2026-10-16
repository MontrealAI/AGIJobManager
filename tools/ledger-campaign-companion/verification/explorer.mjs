import { createHash } from 'node:crypto';
import { getAddress, ZeroAddress } from 'ethers';

export const ETHERSCAN_V2_ENDPOINT = 'https://api.etherscan.io/v2/api';
const TASK_SCHEMA = 'manual-ledger-verification-task-v1';
const STATE_SCHEMA = 'manual-ledger-explorer-state-v1';
const MAX_INPUT = 16 * 1024 * 1024;
const MAX_RESPONSE = 24 * 1024 * 1024;
const hash = text => createHash('sha256').update(text).digest('hex');
const hex32 = value => typeof value === 'string' && /^0x[0-9a-fA-F]{64}$/.test(value);
const plain = value => value !== null && typeof value === 'object' && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype;
const freeze = value => { if (value && typeof value === 'object') { Object.freeze(value); for (const child of Object.values(value)) freeze(child); } return value; };
function fail(code) { const error = new Error(code); error.code = code; throw error; }
const need = (condition, code = 'EXPLORER_TASK_INVALID') => { if (!condition) fail(code); };
const allowedKeys = (value, keys) => plain(value) && Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key));

export function canonicalJson(value, depth = 0, ancestors = new Set()) {
  need(depth <= 100, 'EXPLORER_JSON_INVALID');
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return JSON.stringify(value);
  if (typeof value === 'number') { need(Number.isFinite(value), 'EXPLORER_JSON_INVALID'); return JSON.stringify(value); }
  need((plain(value) || Array.isArray(value)) && !ancestors.has(value), 'EXPLORER_JSON_INVALID');
  ancestors.add(value);
  const result = Array.isArray(value)
    ? `[${value.map(child => canonicalJson(child, depth + 1, ancestors)).join(',')}]`
    : `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonicalJson(value[key], depth + 1, ancestors)}`).join(',')}}`;
  ancestors.delete(value);
  return result;
}

function address(value) {
  try { const result = getAddress(value); need(result !== ZeroAddress); return result; } catch { fail('EXPLORER_TASK_INVALID'); }
}
function qualified(value) {
  need(typeof value === 'string' && value.length <= 1024 && /^[A-Za-z0-9_@./-]+\.sol:[A-Za-z_$][A-Za-z0-9_$]*$/.test(value));
  const separator = value.lastIndexOf(':'), source = value.slice(0, separator), name = value.slice(separator + 1);
  need(!source.startsWith('/') && !source.split('/').some(part => !part || part === '..' || part === '.'));
  return { source, name };
}
function flatLibraries(value) {
  need(plain(value));
  const result = {};
  for (const [key, item] of Object.entries(value)) {
    if (typeof item === 'string') {
      qualified(key); result[key] = address(item).toLowerCase();
    } else {
      need(plain(item));
      for (const [name, target] of Object.entries(item)) { const identity = `${key}:${name}`; qualified(identity); need(!Object.hasOwn(result, identity)); result[identity] = address(target).toLowerCase(); }
    }
  }
  return result;
}

export function prepareVerificationTask(supplied) {
  try {
    need(allowedKeys(supplied, ['schema', 'chainId', 'address', 'qualifiedName', 'compilerVersion', 'standardInput', 'standardInputSha256', 'constructorArguments', 'libraries', 'creation', 'licenseType']));
    const serialized = canonicalJson(supplied);
    need(Buffer.byteLength(serialized) <= MAX_INPUT);
    const task = JSON.parse(serialized);
    need(task.schema === TASK_SCHEMA && task.chainId === 1);
    task.address = address(task.address);
    const identity = qualified(task.qualifiedName);
    need(/^v0\.[0-9]+\.[0-9]+\+commit\.[0-9a-f]{8}$/.test(task.compilerVersion));
    need(typeof task.licenseType === 'string' && /^[1-9][0-9]?$/.test(task.licenseType));
    need(plain(task.standardInput) && task.standardInput.language === 'Solidity' && plain(task.standardInput.sources) && plain(task.standardInput.settings));
    need(Object.hasOwn(task.standardInput.sources, identity.source));
    for (const source of Object.values(task.standardInput.sources)) need(plain(source) && typeof source.content === 'string' && !Object.hasOwn(source, 'urls'));
    const sourceCode = canonicalJson(task.standardInput);
    need(/^[0-9a-f]{64}$/.test(task.standardInputSha256) && hash(sourceCode) === task.standardInputSha256);
    need(canonicalJson(flatLibraries(task.libraries)) === canonicalJson(flatLibraries(task.standardInput.settings.libraries || {})));
    need(typeof task.constructorArguments === 'string' && /^(?:0x)?(?:[0-9a-fA-F]{2})*$/.test(task.constructorArguments));
    task.constructorArguments = task.constructorArguments.replace(/^0x/, '').toLowerCase();
    need(allowedKeys(task.creation, ['transactionHash', 'blockHash', 'blockNumber', 'canonical', 'finalized', 'runtimeVerified']));
    need(hex32(task.creation.transactionHash) && hex32(task.creation.blockHash) && Number.isSafeInteger(task.creation.blockNumber) && task.creation.blockNumber >= 0);
    need(task.creation.canonical === true && task.creation.finalized === true && task.creation.runtimeVerified === true);
    task.creation.transactionHash = task.creation.transactionHash.toLowerCase(); task.creation.blockHash = task.creation.blockHash.toLowerCase();
    const taskId = hash(canonicalJson(task));
    return freeze({ taskId, task, packageSha256: taskId, submission: {
      endpoint: ETHERSCAN_V2_ENDPOINT,
      method: 'POST',
      query: { chainid: '1', module: 'contract', action: 'verifysourcecode' },
      fields: { contractaddress: task.address, sourceCode, codeformat: 'solidity-standard-json-input', contractname: task.qualifiedName, compilerversion: task.compilerVersion, constructorArguments: task.constructorArguments, licenseType: task.licenseType },
    }, scope: 'OFFLINE_PACKAGE_ONLY_CANONICAL_CALLBACK_AND_EXPLICIT_SERVICE_AUTHORIZATION_REQUIRED', authorityComplete: false, activationReady: false });
  } catch { fail('EXPLORER_TASK_INVALID'); }
}

function parseStandardInput(text) {
  need(typeof text === 'string' && Buffer.byteLength(text) <= MAX_RESPONSE, 'EXPLORER_RESPONSE_INVALID');
  const trimmed = text.trim();
  const parsed = JSON.parse(trimmed.startsWith('{{') && trimmed.endsWith('}}') ? trimmed.slice(1, -1) : trimmed);
  need(plain(parsed), 'EXPLORER_RESPONSE_INVALID');
  return parsed;
}
function libraryFieldMatches(value, expected) {
  if (value === '') return true; // The complete Standard JSON link map is still checked independently.
  if (typeof value !== 'string') return false;
  try {
    if (value.trim().startsWith('{')) return canonicalJson(flatLibraries(JSON.parse(value))) === canonicalJson(expected);
    const actual = {};
    for (const item of value.split(';').filter(Boolean)) {
      const separator = item.lastIndexOf(':');
      let key = item.slice(0, separator), target = item.slice(separator + 1);
      if (!key.includes(':')) {
        const keys = Object.keys(expected).filter(candidate => candidate.endsWith(`:${key}`));
        if (keys.length !== 1) return false;
        key = keys[0];
      }
      if (Object.hasOwn(actual, key)) return false;
      actual[key] = address(target.startsWith('0x') ? target : `0x${target}`).toLowerCase();
    }
    return canonicalJson(actual) === canonicalJson(expected);
  } catch { return false; }
}

// A service's status banner is never an exact-source certificate.
export function compareExplorerSource(prepared, payload) {
  try {
    need(payload?.status === '1' && Array.isArray(payload.result) && payload.result.length === 1, 'EXPLORER_RESPONSE_INVALID');
    const row = payload.result[0];
    need(plain(row) && row.SimilarMatch === '', 'EXPLORER_SOURCE_MISMATCH');
    if (row.SourceCode === '' && (!row.ContractName || row.ABI === 'Contract source code not verified')) return 'unverified';
    const task = prepared.task, identity = qualified(task.qualifiedName);
    need((row.ContractName === identity.name && row.ContractFileName === identity.source) || (row.ContractName === task.qualifiedName && (row.ContractFileName === '' || row.ContractFileName === identity.source)), 'EXPLORER_SOURCE_MISMATCH');
    need(row.CompilerVersion === task.compilerVersion && (row.CompilerType === undefined || row.CompilerType === 'solc'), 'EXPLORER_SOURCE_MISMATCH');
    need(typeof row.ConstructorArguments === 'string' && /^(?:0x)?(?:[0-9a-fA-F]{2})*$/.test(row.ConstructorArguments) && row.ConstructorArguments.replace(/^0x/, '').toLowerCase() === task.constructorArguments, 'EXPLORER_SOURCE_MISMATCH');
    const input = parseStandardInput(row.SourceCode);
    need(canonicalJson(input) === canonicalJson(task.standardInput), 'EXPLORER_SOURCE_MISMATCH');
    const expected = flatLibraries(task.libraries);
    need(canonicalJson(flatLibraries(input.settings?.libraries || {})) === canonicalJson(expected) && libraryFieldMatches(row.Library, expected), 'EXPLORER_SOURCE_MISMATCH');
    return 'exact';
  } catch { return 'mismatch'; }
}

const report = (prepared, state, code) => freeze({
  state, packageSha256: prepared.packageSha256, explorerStatus: code,
  ...(state === 'blocked' || state === 'recovery-required' ? { blocker: code } : {}),
  address: prepared.task.address, chainId: 1, authorityComplete: false, activationReady: false, productionApproved: false,
});
const wait = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));

// This module is server-only. The API key is a factory secret, never a task,
// journal field, offline package, returned report or error message.
export function createExplorerVerifier({ fetch: fetchImpl = globalThis.fetch, apiKey, authorizeService, validateCanonical, readState, transition, sleep = wait, clock = Date.now, limits = {} } = {}) {
  const policy = { readAttempts: 3, maxPolls: 4, timeoutMs: 10000, intervalMs: 600, pollMs: 1000, ...limits };
  need(Object.keys(policy).length === 5 && Number.isSafeInteger(policy.readAttempts) && policy.readAttempts >= 1 && policy.readAttempts <= 5 && Number.isSafeInteger(policy.maxPolls) && policy.maxPolls >= 1 && policy.maxPolls <= 10 && Number.isSafeInteger(policy.timeoutMs) && policy.timeoutMs >= 50 && policy.timeoutMs <= 15000 && Number.isSafeInteger(policy.intervalMs) && policy.intervalMs >= 500 && policy.intervalMs <= 5000 && Number.isSafeInteger(policy.pollMs) && policy.pollMs >= 500 && policy.pollMs <= 10000, 'EXPLORER_POLICY_INVALID');
  let tail = Promise.resolve(), lastRequest = null;
  const once = new Set();
  function serial(operation) { const result = tail.then(operation); tail = result.catch(() => {}); return result; }
  async function fresh(prepared) {
    let proof;
    try { proof = await validateCanonical(prepared.task); } catch { fail('EXPLORER_CANONICAL_PROOF_REQUIRED'); }
    const creation = prepared.task.creation;
    need(proof && proof.chainId === 1 && proof.canonical === true && proof.finalized === true && proof.runtimeVerified === true && proof.newTarget === true && typeof proof.address === 'string' && proof.address.toLowerCase() === prepared.task.address.toLowerCase() && typeof proof.transactionHash === 'string' && proof.transactionHash.toLowerCase() === creation.transactionHash && typeof proof.blockHash === 'string' && proof.blockHash.toLowerCase() === creation.blockHash && proof.blockNumber === creation.blockNumber, 'EXPLORER_CANONICAL_PROOF_REQUIRED');
  }
  async function body(response) {
    need(response && typeof response.status === 'number' && response.redirected !== true, 'EXPLORER_RESPONSE_INVALID');
    if (response.url) { const target = new URL(response.url); need(`${target.origin}${target.pathname}` === ETHERSCAN_V2_ENDPOINT, 'EXPLORER_RESPONSE_INVALID'); }
    const length = response.headers?.get('content-length');
    need(!length || (/^[0-9]+$/.test(length) && Number(length) <= MAX_RESPONSE), 'EXPLORER_RESPONSE_TOO_LARGE');
    need(response.body && typeof response.body.getReader === 'function', 'EXPLORER_RESPONSE_INVALID');
    const reader = response.body.getReader();
    let bytes = 0; const pieces = [];
    try {
      while (true) { const next = await reader.read(); if (next.done) break; bytes += next.value.length; need(bytes <= MAX_RESPONSE, 'EXPLORER_RESPONSE_TOO_LARGE'); pieces.push(Buffer.from(next.value)); }
    } finally { try { await reader.cancel(); } catch {} }
    let parsed; try { parsed = JSON.parse(Buffer.concat(pieces).toString('utf8')); } catch { fail('EXPLORER_RESPONSE_INVALID'); }
    need(plain(parsed), 'EXPLORER_RESPONSE_INVALID');
    return parsed;
  }
  async function request(prepared, action, { method = 'GET', guid } = {}) {
    const attempts = method === 'GET' ? policy.readAttempts : 1;
    for (let attempt = 0; attempt < attempts; attempt++) {
      await fresh(prepared);
      if (lastRequest !== null) { await sleep(Math.max(0, policy.intervalMs - (clock() - lastRequest))); await fresh(prepared); }
      const url = new URL(ETHERSCAN_V2_ENDPOINT);
      for (const [key, value] of Object.entries({ chainid: '1', module: 'contract', action, apikey: apiKey, ...(action === 'getsourcecode' ? { address: prepared.task.address } : {}), ...(guid ? { guid } : {}) })) url.searchParams.set(key, value);
      const controller = new AbortController(); let timer;
      try {
        const timed = new Promise((_resolve, reject) => { timer = setTimeout(() => { controller.abort(); reject(new Error('EXPLORER_TIMEOUT')); }, policy.timeoutMs); });
        const operation = (async () => {
          const response = await fetchImpl(url.toString(), { method, redirect: 'error', credentials: 'omit', cache: 'no-store', signal: controller.signal, headers: { Accept: 'application/json', ...(method === 'POST' ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {}) }, ...(method === 'POST' ? { body: new URLSearchParams(prepared.submission.fields).toString() } : {}) });
          let result;
          try { result = await body(response); }
          catch (error) {
            if ((response?.status === 429 || response?.status >= 500) && error?.code === 'EXPLORER_RESPONSE_INVALID') result = { status: '0', result: 'SERVICE_UNAVAILABLE' };
            else throw error;
          }
          return { response, result };
        })();
        const { response, result } = await Promise.race([operation, timed]);
        lastRequest = clock();
        const rate = response.status === 429 || (result.status === '0' && typeof result.result === 'string' && /rate limit|too many requests|max calls/i.test(result.result));
        const transient = rate || response.status >= 500;
        if (method === 'GET' && transient && attempt + 1 < attempts) {
          const retryHeader = response.headers?.get('retry-after'), seconds = retryHeader && /^[0-9]+$/.test(retryHeader) ? Math.min(Number(retryHeader), 10) : 0;
          await sleep(Math.max(seconds * 1000, Math.min(4000, 500 * 2 ** attempt))); continue;
        }
        need(response.status >= 200 && response.status < 300 && !rate, rate ? 'EXPLORER_RATE_LIMITED' : 'EXPLORER_SERVICE_UNAVAILABLE');
        return result;
      } catch (error) {
        lastRequest = clock();
        if (method === 'GET' && attempt + 1 < attempts && !['EXPLORER_RESPONSE_TOO_LARGE', 'EXPLORER_RESPONSE_INVALID'].includes(error?.code)) { await sleep(Math.min(4000, 500 * 2 ** attempt)); continue; }
        fail(method === 'POST' ? 'EXPLORER_SUBMISSION_UNCERTAIN' : 'EXPLORER_READ_UNAVAILABLE');
      } finally { clearTimeout(timer); }
    }
    fail('EXPLORER_READ_UNAVAILABLE');
  }
  async function load(prepared) {
    let state; try { state = await readState(prepared.taskId); } catch { fail('EXPLORER_JOURNAL_UNAVAILABLE'); }
    if (state === null || state === undefined) return null;
    const keys = ['schema', 'taskId', 'state', 'submissionAttempted', 'updatedAt', ...(state.guid !== undefined ? ['guid'] : []), ...(state.reason !== undefined ? ['reason'] : [])];
    need(allowedKeys(state, keys) && state.schema === STATE_SCHEMA && state.taskId === prepared.taskId && ['prepared', 'submission-attempted', 'pending', 'submission-uncertain', 'verified', 'blocked', 'failed'].includes(state.state) && typeof state.submissionAttempted === 'boolean' && typeof state.updatedAt === 'string' && Number.isFinite(Date.parse(state.updatedAt)), 'EXPLORER_JOURNAL_INVALID');
    need(state.guid === undefined || (state.submissionAttempted && typeof state.guid === 'string' && /^[A-Za-z0-9_-]{16,128}$/.test(state.guid)), 'EXPLORER_JOURNAL_INVALID');
    need(state.reason === undefined || /^[A-Z_]{1,96}$/.test(state.reason), 'EXPLORER_JOURNAL_INVALID');
    need(!['submission-attempted', 'pending', 'submission-uncertain', 'failed'].includes(state.state) || state.submissionAttempted, 'EXPLORER_JOURNAL_INVALID');
    return JSON.parse(canonicalJson(state));
  }
  async function save(prepared, previous, state, extra = {}) {
    const next = { schema: STATE_SCHEMA, taskId: prepared.taskId, state, submissionAttempted: previous?.submissionAttempted === true, updatedAt: new Date(clock()).toISOString(), ...(previous?.guid ? { guid: previous.guid } : {}), ...extra };
    need(!previous?.submissionAttempted || next.submissionAttempted, 'EXPLORER_JOURNAL_INVALID');
    try { await transition(freeze(JSON.parse(canonicalJson(next))), { taskId: prepared.taskId, expectedPreviousDigest: previous ? hash(canonicalJson(previous)) : null }); } catch { fail('EXPLORER_JOURNAL_UNAVAILABLE'); }
    const persisted = await load(prepared);
    need(persisted && canonicalJson(persisted) === canonicalJson(next), 'EXPLORER_JOURNAL_UNAVAILABLE');
    return persisted;
  }
  async function source(prepared) {
    const payload = await request(prepared, 'getsourcecode');
    need(payload.status === '1' && Array.isArray(payload.result) && payload.result.length === 1, 'EXPLORER_READ_UNAVAILABLE');
    return compareExplorerSource(prepared, payload);
  }
  async function run(supplied, maySubmit) {
    const prepared = prepareVerificationTask(supplied);
    need(typeof fetchImpl === 'function' && typeof apiKey === 'string' && apiKey.length >= 1 && apiKey.length <= 256 && !/[\r\n]/.test(apiKey) && typeof validateCanonical === 'function' && typeof readState === 'function' && typeof transition === 'function', 'EXPLORER_SECURE_SETUP_REQUIRED');
    let state = await load(prepared);
    if (!state) state = await save(prepared, null, 'prepared');
    try {
      const verdict = await source(prepared);
      if (verdict === 'exact') { await fresh(prepared); await save(prepared, state, 'verified'); return report(prepared, 'verified', 'EXACT_SOURCE_VERIFIED'); }
      if (state.state === 'verified') { await save(prepared, state, 'blocked', { reason: 'EXPLORER_VERIFIED_SOURCE_CHANGED' }); return report(prepared, 'blocked', 'EXPLORER_VERIFIED_SOURCE_CHANGED'); }
      if (verdict !== 'unverified') { await save(prepared, state, 'blocked', { reason: 'EXPLORER_SOURCE_MISMATCH' }); return report(prepared, 'blocked', 'EXPLORER_SOURCE_MISMATCH'); }
      if (!state.submissionAttempted && !once.has(prepared.taskId)) {
        if (!maySubmit) return report(prepared, 'exported', 'SOURCE_PACKAGE_EXPORTED');
        let authorization; try { authorization = await authorizeService?.({ service: 'etherscan-v2', taskId: prepared.taskId, address: prepared.task.address, sourceSha256: prepared.task.standardInputSha256 }); } catch { fail('EXPLORER_SERVICE_AUTHORIZATION_REQUIRED'); }
        need(authorization?.service === 'etherscan-v2' && authorization.taskId === prepared.taskId && authorization.submitSource === true, 'EXPLORER_SERVICE_AUTHORIZATION_REQUIRED');
        await fresh(prepared);
        state = await save(prepared, state, 'submission-attempted', { submissionAttempted: true });
        once.add(prepared.taskId);
        let submission;
        try { submission = await request(prepared, 'verifysourcecode', { method: 'POST' }); }
        catch { state = await save(prepared, state, 'submission-uncertain', { reason: 'EXPLORER_SUBMISSION_UNCERTAIN' }); return report(prepared, 'recovery-required', 'EXPLORER_SUBMISSION_UNCERTAIN'); }
        if (submission.status === '1' && typeof submission.result === 'string' && /^[A-Za-z0-9_-]{16,128}$/.test(submission.result)) state = await save(prepared, state, 'pending', { guid: submission.result });
        else if (submission.status === '0' && typeof submission.result === 'string' && /already verified/i.test(submission.result)) {
          if (await source(prepared) === 'exact') { await fresh(prepared); await save(prepared, state, 'verified'); return report(prepared, 'verified', 'EXACT_SOURCE_VERIFIED'); }
          await save(prepared, state, 'blocked', { reason: 'EXPLORER_SOURCE_MISMATCH' }); return report(prepared, 'blocked', 'EXPLORER_SOURCE_MISMATCH');
        } else if (submission.status === '0' && typeof submission.result === 'string') { await save(prepared, state, 'failed', { reason: 'EXPLORER_SUBMISSION_REJECTED' }); return report(prepared, 'blocked', 'EXPLORER_SUBMISSION_REJECTED'); }
        else { await save(prepared, state, 'submission-uncertain', { reason: 'EXPLORER_SUBMISSION_UNCERTAIN' }); return report(prepared, 'recovery-required', 'EXPLORER_SUBMISSION_UNCERTAIN'); }
      }
      if (!state.guid) return report(prepared, 'recovery-required', 'EXPLORER_SUBMISSION_UNCERTAIN');
      for (let poll = 0; poll < policy.maxPolls; poll++) {
        const result = await request(prepared, 'checkverifystatus', { guid: state.guid });
        if (result.status === '1' && result.result === 'Pass - Verified') {
          if (await source(prepared) !== 'exact') { await save(prepared, state, 'blocked', { reason: 'EXPLORER_SOURCE_MISMATCH' }); return report(prepared, 'blocked', 'EXPLORER_SOURCE_MISMATCH'); }
          await fresh(prepared); await save(prepared, state, 'verified'); return report(prepared, 'verified', 'EXACT_SOURCE_VERIFIED');
        }
        if (!(result.status === '0' && typeof result.result === 'string' && /^(?:pending in queue|in progress|pending)$/i.test(result.result))) { await save(prepared, state, 'failed', { reason: 'EXPLORER_VERIFICATION_FAILED' }); return report(prepared, 'blocked', 'EXPLORER_VERIFICATION_FAILED'); }
        if (poll + 1 < policy.maxPolls) await sleep(policy.pollMs);
      }
      return report(prepared, 'pending', 'EXPLORER_PENDING');
    } catch (error) {
      const permitted = new Set(['EXPLORER_CANONICAL_PROOF_REQUIRED', 'EXPLORER_SERVICE_AUTHORIZATION_REQUIRED', 'EXPLORER_READ_UNAVAILABLE', 'EXPLORER_JOURNAL_UNAVAILABLE', 'EXPLORER_JOURNAL_INVALID']);
      const code = permitted.has(error?.code) ? error.code : 'EXPLORER_VERIFICATION_BLOCKED';
      return report(prepared, state?.submissionAttempted ? 'recovery-required' : 'blocked', code);
    }
  }
  return Object.freeze({ prepare: prepareVerificationTask, verify: supplied => serial(() => run(supplied, true)), recover: supplied => serial(() => run(supplied, false)) });
}
