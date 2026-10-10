'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { Interface } = require('ethers');

const report = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures/etherscan-grouped-links.json'), 'utf8'));
const { verifyEtherscan } = require('../scripts/verify-etherscan.cjs');
function loadVerifier() { return verifyEtherscan; }

function nested(rows, valueKey) {
  const output = {};
  for (const row of rows) {
    const separator = row.fqn.lastIndexOf(':');
    const source = row.fqn.slice(0, separator), name = row.fqn.slice(separator + 1);
    output[source] ||= {};
    output[source][name] = structuredClone(row[valueKey]);
  }
  return output;
}

function fixture(target, mutate) {
  const comparison = target.comparison;
  const sources = {};
  for (const row of comparison.configuredLibraries.rows) {
    const separator = row.fqn.lastIndexOf(':');
    const source = row.fqn.slice(0, separator), name = row.fqn.slice(separator + 1);
    sources[source] = { content: `pragma solidity ^0.8.37; library ${name} {}` };
  }
  sources[target.local.artifactInputSourceName] = {
    content: `pragma solidity ^0.8.37; contract ${target.name} { function syntheticProbe() external pure returns (uint256) { return 1; } }`
  };
  const abi = JSON.parse(new Interface(['function syntheticProbe() view returns (uint256)']).formatJson());
  const artifact = {
    contractName: target.name,
    sourceName: target.local.artifactSourceName,
    inputSourceName: target.local.artifactInputSourceName,
    abi,
    linkReferences: nested(comparison.creationReferences.rows, 'positions'),
    deployedLinkReferences: nested(comparison.deployedReferences.rows, 'positions')
  };
  const input = { language: 'Solidity', sources, settings: { optimizer: { enabled: true, runs: 200 }, viaIR: true, libraries: {} } };
  const published = structuredClone(input);
  published.settings.libraries = nested(comparison.publishedLibraries.rows, 'value');
  if (mutate) mutate(published, artifact);
  const buildInfo = { solcLongVersion: target.record.compilerVersion.slice(1), input };
  const record = {
    ContractName: target.record.contractName,
    CompilerVersion: target.record.compilerVersion,
    ConstructorArguments: '',
    SimilarMatch: '',
    ABI: JSON.stringify(abi),
    SourceCode: `{${JSON.stringify(published)}}`
  };
  const requests = [];
  const options = {
    chainId: report.chainId, address: target.address, artifact, buildInfo,
    libraries: Object.fromEntries(comparison.configuredLibraries.rows.map(row => [row.fqn, row.value])),
    apiKey: 'synthetic-fixture-key', pollDelayMs: 0, maxPolls: 1,
    fetchImpl: async (url, request) => {
      const action = url.searchParams.get('action');
      requests.push({ method: request.method, action });
      assert.equal(url.origin, 'https://api.etherscan.io');
      assert.equal(url.searchParams.get('chainid'), String(report.chainId));
      assert.equal(url.searchParams.get('address'), target.address);
      assert.equal(request.method, 'GET');
      assert.equal(action, 'getsourcecode');
      assert.equal(request.body, undefined);
      return { ok: true, json: async () => ({ status: '1', message: 'OK', result: [record] }) };
    }
  };
  return { options, requests };
}

for (const target of report.targets) {
  test(`standard entrypoint accepts reported ${target.name} grouping with synthetic matching core/ABI`, async () => {
    const { options, requests } = fixture(target);
    assert.equal(await loadVerifier('v2')(options), true);
    assert.deepEqual(requests, [{ method: 'GET', action: 'getsourcecode' }]);
  });
}

test('standard entrypoint still rejects an altered reported library address', async () => {
  const { options, requests } = fixture(report.targets[0], published => {
    const [group] = Object.values(published.settings.libraries);
    group[Object.keys(group)[0]] = '0x1111111111111111111111111111111111111111';
  });
  await assert.rejects(loadVerifier('v2')(options), /linked libraries or ABI differs/);
  assert.deepEqual(requests, [{ method: 'GET', action: 'getsourcecode' }]);
});

test('standard entrypoint still rejects source grouping other than the artifact input source', async () => {
  const { options, requests } = fixture(report.targets[0], published => {
    const [source] = Object.keys(published.settings.libraries);
    published.settings.libraries['project/contracts/unrelated.sol'] = published.settings.libraries[source];
    delete published.settings.libraries[source];
  });
  await assert.rejects(loadVerifier('v2')(options), /linked libraries or ABI differs/);
  assert.deepEqual(requests, [{ method: 'GET', action: 'getsourcecode' }]);
});
