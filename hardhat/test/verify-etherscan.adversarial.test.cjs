const test = require('node:test');
const assert = require('node:assert/strict');
const { Interface } = require('ethers');
const { verifyEtherscan } = require('../scripts/verify-etherscan.cjs');

const ADDRESS = `0x${'31'.repeat(20)}`;
const LIBRARY = `0x${'42'.repeat(20)}`;
const OTHER = `0x${'53'.repeat(20)}`;
const artifact = {
  contractName: 'ReviewFixture', sourceName: 'contracts/ReviewFixture.sol',
  abi: ['constructor(address owner, string base)', 'function value() view returns (uint256)'],
};
const constructorArguments = [ADDRESS, 'ipfs://reviewed/'];
const input = {
  language: 'Solidity',
  sources: {
    'contracts/ReviewFixture.sol': { content: 'contract ReviewFixture { constructor(address owner, string memory base) {} function value() external pure returns (uint256) { return 1; } }' },
    'contracts/FixtureLibrary.sol': { content: 'library FixtureLibrary { function value() external pure returns (uint256) { return 1; } }' },
  },
  settings: {
    optimizer: { enabled: true, runs: 40 }, viaIR: true, evmVersion: 'shanghai',
    metadata: { bytecodeHash: 'none' }, debug: { revertStrings: 'strip' },
    libraries: { 'contracts/FixtureLibrary.sol': { FixtureLibrary: LIBRARY } },
  },
};
const buildInfo = { solcLongVersion: '0.8.37+commit.abc12345', input };
const encodedArgs = new Interface(artifact.abi).encodeDeploy(constructorArguments).slice(2);
const record = () => ({
  SourceCode: `{${JSON.stringify(input)}}`, ABI: new Interface(artifact.abi).formatJson(),
  ContractName: artifact.contractName, CompilerVersion: 'v0.8.37+commit.abc12345',
  ConstructorArguments: encodedArgs, SimilarMatch: '', Proxy: '0', Implementation: '',
});
const response = value => ({ status: '1', message: 'OK', result: [value] });
function run(responses) {
  let requests = 0;
  return verifyEtherscan({
    chainId: 1, address: ADDRESS, artifact, buildInfo, constructorArguments,
    libraries: { 'contracts/FixtureLibrary.sol:FixtureLibrary': LIBRARY },
    apiKey: 'canary-only-no-live-key', pollDelayMs: 0, maxPolls: 1,
    fetchImpl: async () => {
      assert(requests < responses.length, 'Unexpected additional explorer request');
      return { ok: true, json: async () => responses[requests++] };
    },
  });
}
function changedInput(mutate) {
  const changed = structuredClone(input);
  mutate(changed);
  return { ...record(), SourceCode: `{${JSON.stringify(changed)}}` };
}

test('source identity survives harmless object ordering but rejects altered, absent or extra source content', async () => {
  const reordered = Object.fromEntries(Object.entries(input).reverse());
  assert.equal(await run([response({ ...record(), SourceCode: JSON.stringify(reordered) })]), true);
  for (const mutate of [
    value => { value.sources['contracts/ReviewFixture.sol'].content += '\n// unreviewed change'; },
    value => { delete value.sources['contracts/FixtureLibrary.sol']; },
    value => { value.sources['contracts/Extra.sol'] = { content: 'contract Extra {}' }; },
  ]) await assert.rejects(run([response(changedInput(mutate))]), /differs/);
});

test('all bytecode-affecting compiler settings must match the reviewed build', async () => {
  for (const mutate of [
    value => { value.settings.optimizer.runs = 200; },
    value => { value.settings.optimizer.enabled = false; },
    value => { value.settings.viaIR = false; },
    value => { value.settings.evmVersion = 'cancun'; },
    value => { value.settings.metadata.bytecodeHash = 'ipfs'; },
    value => { value.settings.debug.revertStrings = 'default'; },
  ]) await assert.rejects(run([response(changedInput(mutate))]), /differs/);
});

test('linked library substitutions, missing links and added links cannot qualify', async () => {
  for (const mutate of [
    value => { value.settings.libraries['contracts/FixtureLibrary.sol'].FixtureLibrary = OTHER; },
    value => { delete value.settings.libraries['contracts/FixtureLibrary.sol']; },
    value => { value.settings.libraries['contracts/Unreviewed.sol'] = { Extra: OTHER }; },
  ]) await assert.rejects(run([response(changedInput(mutate))]), /differs/);
});

test('missing ABI methods, altered output types and malformed extra fragments cannot qualify', async () => {
  const abi = JSON.parse(record().ABI);
  const changedOutput = structuredClone(abi);
  changedOutput.find(entry => entry.type === 'function').outputs[0].type = 'address';
  for (const changed of [abi.filter(entry => entry.type !== 'function'), changedOutput, [...abi, { type: 'not-an-abi-fragment' }]]) {
    await assert.rejects(run([response({ ...record(), ABI: JSON.stringify(changed) })]), /ABI|fragment|differs/);
  }
});

test('constructor contents cannot be omitted, replaced or accepted merely because runtime source matches', async () => {
  const altered = new Interface(artifact.abi).encodeDeploy([OTHER, 'ipfs://reviewed/']).slice(2);
  for (const value of ['', altered, '0', undefined]) {
    await assert.rejects(run([response({ ...record(), ConstructorArguments: value })]), /constructor|differs/);
  }
});

test('contradictory success metadata and similar-match records do not establish exact verification', async () => {
  await assert.rejects(run([{ ...response(record()), message: 'NOTOK' }]), /failed|malformed|status|success/);
  await assert.rejects(run([response({ ...record(), SimilarMatch: OTHER })]), /similar|exact|verification|request|differs/i);
});

test('a completed submission still fails when source changes during verification readback', async () => {
  const tampered = changedInput(value => { value.settings.viaIR = false; });
  await assert.rejects(run([
    response({ SourceCode: '', ABI: 'Contract source code not verified' }),
    { status: '1', message: 'OK', result: 'a'.repeat(32) },
    { status: '1', message: 'OK', result: 'Pass - Verified' },
    response(tampered),
  ]), /differs/);
});
