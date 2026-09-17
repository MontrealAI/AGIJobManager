const test = require('node:test');
const assert = require('node:assert/strict');
const { Interface } = require('ethers');
const { verifyEtherscan } = require('../scripts/verify-etherscan.cjs');
const ADDRESS = `0x${'11'.repeat(20)}`;
const LIBRARY = `0x${'22'.repeat(20)}`;
const KEY = 'never-print-test-api-key';
const artifact = { sourceName: 'contracts/Manager.sol', inputSourceName: 'project/contracts/Manager.sol', contractName: 'Manager',
  abi: ['constructor(address owner, string base)'] };
const buildInfo = { solcLongVersion: '0.8.37+commit.abc12345', userSourceNameMap: {
  'contracts/Manager.sol': 'project/contracts/Manager.sol', 'contracts/Lib.sol': 'project/contracts/Lib.sol' },
  input: { language: 'Solidity', sources: { 'project/contracts/Manager.sol': { content: 'contract Manager {}' } },
    settings: { optimizer: { enabled: true, runs: 40 }, viaIR: true } } };
const unverified = { status: '1', message: 'OK', result: [{ SourceCode: '', ABI: 'Contract source code not verified' }] };
const verifiedInput = structuredClone(buildInfo.input);
verifiedInput.settings.libraries = { 'project/contracts/Lib.sol': { Lib: LIBRARY } };
const verified = { status: '1', message: 'OK', result: [{ SourceCode: `{${JSON.stringify(verifiedInput)}}`,
  ABI: new Interface(artifact.abi).formatJson(), ConstructorArguments: new Interface(artifact.abi).encodeDeploy([ADDRESS, 'ipfs://reviewed/']).slice(2),
  ContractName: 'Manager', CompilerVersion: 'v0.8.37+commit.abc12345' }] };
const accepted = { status: '1', message: 'OK', result: 'a7lpxkm9kpcpicx7daftmjifrfhiuhf5vqqnawhkfhzfrcpnxj' };
const pending = { status: '0', message: 'NOTOK', result: 'Pending in queue' };
const complete = { status: '1', message: 'OK', result: 'Pass - Verified' };
function harness(responses, overrides = {}) {
  const calls = [];
  const options = { chainId: 1, address: ADDRESS, apiKey: KEY, artifact, buildInfo,
    constructorArguments: [ADDRESS, 'ipfs://reviewed/'], libraries: { 'contracts/Lib.sol:Lib': LIBRARY },
    pollDelayMs: 0, maxPolls: 2, fetchImpl: async (url, init) => {
      calls.push({ url: new URL(url), init });
      const result = responses.shift();
      if (result instanceof Error) throw result;
      if (result?.httpFailure) return { ok: false };
      return { ok: true, json: async () => result };
    }, ...overrides };
  return { run: () => verifyEtherscan(options), calls };
}

test('native verification submits exact standard JSON, linked addresses and encoded constructor arguments, then confirms source', async () => {
  const before = JSON.stringify(buildInfo);
  const run = harness([unverified, accepted, pending, complete, verified]);
  assert.equal(await run.run(), true);
  assert.deepEqual(run.calls.map(call => call.url.searchParams.get('action')), ['getsourcecode', 'verifysourcecode', 'checkverifystatus', 'checkverifystatus', 'getsourcecode']);
  const submission = run.calls[1];
  assert.equal(submission.init.method, 'POST');
  const fields = new URLSearchParams(submission.init.body);
  assert.equal(fields.get('contractname'), 'project/contracts/Manager.sol:Manager');
  assert.equal(fields.get('compilerversion'), 'v0.8.37+commit.abc12345');
  assert.equal(fields.get('constructorArguments'), new Interface(artifact.abi).encodeDeploy([ADDRESS, 'ipfs://reviewed/']).slice(2));
  const input = JSON.parse(fields.get('sourceCode'));
  assert.equal(input.settings.libraries['project/contracts/Lib.sol'].Lib, LIBRARY);
  assert.equal(JSON.stringify(buildInfo), before);
  for (const call of run.calls) {
    assert.equal(call.url.origin, 'https://api.etherscan.io');
    assert.equal(call.url.searchParams.get('chainid'), '1');
    assert.equal(call.init.redirect, 'error');
    assert(call.init.signal);
  }
});

test('already verified requires a fresh successful matching source and compiler record', async () => {
  const run = harness([verified]);
  assert.equal(await run.run(), true);
  assert.equal(run.calls.length, 1);
  for (const field of ['CompilerVersion', 'ContractName', 'SourceCode', 'ABI', 'ConstructorArguments']) {
    const changed = structuredClone(verified); changed.result[0][field] = 'wrong';
    await assert.rejects(harness([changed]).run(), /invalid verified|differs/);
  }
});

test('HTTP, malformed, rate-limited and misleading success responses cannot establish verification', async () => {
  for (const failure of [null, {}, { status: '1', message: 'OK', result: [] },
    { status: '0', message: 'NOTOK', result: 'Max rate limit reached' }, { httpFailure: true }]) {
    await assert.rejects(harness([failure]).run(), /failed|did not return/);
  }
  for (const failure of [{ status: '0', message: 'NOTOK', result: 'Already Verified' },
    { status: '1', message: 'OK', result: 'Pass - Verified' }]) {
    await assert.rejects(harness([unverified, failure]).run(), /did not accept/);
  }
  for (const failure of [{ ...complete, status: '0' }, { ...complete, result: 'not already verified' },
    { ...complete, result: 'Fail - Unable to verify' }]) {
    await assert.rejects(harness([unverified, accepted, failure]).run(), /failed|unrecognized/);
  }
});

test('pending verification and missing post-verification source remain failed outcomes', async () => {
  await assert.rejects(harness([unverified, accepted, pending, pending]).run(), /remains pending/);
  await assert.rejects(harness([unverified, accepted, complete, unverified]).run(), /lacks the verified source/);
});

test('network failures do not expose the API key through error messages', async () => {
  await assert.rejects(harness([new Error(`fetch failed https://api.etherscan.io?apikey=${KEY}`)]).run(), error => {
    assert(!String(error).includes(KEY));
    assert.equal(error.cause, undefined);
    return /request failed/.test(error.message);
  });
});

test('missing credentials, wrong chain and invalid constructor arguments fail before explorer requests', async () => {
  for (const overrides of [{ apiKey: '' }, { chainId: 31337 }, { address: 'invalid' }, { constructorArguments: [] }]) {
    const run = harness([], overrides);
    await assert.rejects(run.run());
    assert.equal(run.calls.length, 0);
  }
});
