'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { test } = require('node:test');
const solc = require('solc');
const ethers = require('ethers');
const root = path.resolve(__dirname, '../..');
const originalSteps = 'dfDvulfnTUtnIfxa[r]EscLMVcul[j]Trpeulxa[r]cLvifMCTUca[r]LSsTFOtfDnca[r]IulcscCTUtvifMx[scCTUt]TOntnfDIulvifMjmul[jul]VcTOculjmul:fDnTOcmuO';
const mitigatedSteps = originalSteps.replace(/[EL]/g, '');

async function profile() {
  return (await import(pathToFileURL(path.join(root, 'hardhat/hardhat.config.js')))).default.solidity.profiles;
}
function compile(language, content, settings, name) {
  const input = { language, sources: { 'Fixture.sol': { content } }, settings: { ...settings,
    outputSelection: { '*': { '*': ['abi', 'evm.bytecode.object'] } } } };
  const result = JSON.parse(solc.compile(JSON.stringify(input)));
  assert.deepEqual((result.errors || []).filter(e => e.severity !== 'info'), [], 'Regression fixtures must compile without warnings');
  return result.contracts['Fixture.sol'][name];
}
async function local(run) {
  const { createHardhatRuntimeEnvironment } = await import(pathToFileURL(require.resolve('hardhat/hre')));
  const config = { networks: { hardhat: { type: 'edr-simulated', chainType: 'l1', chainId: 31337,
    hardfork: 'osaka', allowUnlimitedContractSize: false,
    accounts: { mnemonic: 'test test test test test test test test test test test junk', count: 1 } } } };
  const hre = await createHardhatRuntimeEnvironment(config, { config: path.join(root, 'hardhat.config.mjs') }, root);
  const connection = await hre.network.connect('hardhat');
  try {
    const provider = new ethers.BrowserProvider(connection.provider);
    assert.equal((await provider.getNetwork()).chainId, 31337n);
    await run(provider, await provider.getSigner());
  } finally { await connection.close(); }
}

test('Hardhat, Foundry and deployment checks pin the same complete E/L-free optimizer profile', async () => {
  const profiles = await profile();
  assert.deepEqual(profiles.default, profiles.production);
  assert.equal(profiles.production.version, '0.8.37');
  assert.equal(solc.version(), '0.8.37+commit.f401782d.Emscripten.clang');
  const expected = { enabled: true, runs: 40, details: { yulDetails: { optimizerSteps: mitigatedSteps } } };
  assert.deepEqual(profiles.production.settings.optimizer, expected);
  assert(!/[EL]/.test(mitigatedSteps));
  const foundry = fs.readFileSync(path.join(root, 'foundry.toml'), 'utf8');
  assert.equal(foundry.match(/optimizerSteps = "([^"]+)"/)[1], mitigatedSteps);
  assert.match(foundry, /^optimizer = true$/m);
  assert.match(foundry, /^optimizer_runs = 40$/m);
  assert.match(foundry, /^via_ir = true$/m);
  assert.match(foundry, /^evm_version = "shanghai"$/m);
  const { COMPILER_SETTINGS } = require('../../hardhat/scripts/deploy.cjs');
  assert.deepEqual(COMPILER_SETTINGS, { version: profiles.production.version, ...profiles.production.settings });
});

// Adapted from upstream #17116 semanticTests/optimizer/reassigned_reference_*.sol.
const source = `// SPDX-License-Identifier: MIT
pragma solidity =0.8.37;
contract Regression {
    uint s0 = 0x400; uint s1; uint s2 = 0x300;
    struct S { uint v; } S[20] public a;
    function memoryLoad(uint, uint) public view returns (uint result) {
        assembly {
            let v := sload(0)
            if calldataload(4) { v := sload(1) }
            let p := add(v, 0x100)
            mstore(p, 67)
            if calldataload(36) { v := sload(2) }
            mstore(add(v, 0x200), 7)
            result := mload(p)
        }
    }
    function memoryHash() public view returns (bytes32 result) {
        assembly {
            let v := sload(0)
            let p := add(v, 0x100)
            mstore(p, 67)
            v := sload(2)
            mstore(add(v, 0x200), 7)
            result := keccak256(p, 32)
        }
    }
    function g(uint n1, uint n2, uint v, uint w) external returns (uint) {
        uint i;
        for (uint j; j < n1; j++) i++;
        uint k = i + 2;
        a[k].v = v;
        for (uint j; j < n2; j++) i++;
        a[i].v = w;
        return a[k].v;
    }
    function rmw(uint n1, uint n2) external {
        uint i;
        for (uint j; j < n1; j++) i++;
        uint k = i + 1;
        a[k].v = 100;
        for (uint j; j < n2; j++) i++;
        a[i].v = 500;
        a[k].v += 1;
    }
}`;

test('production profile preserves memory load/hash, storage alias and read-modify-write semantics', async () => {
  const settings = (await profile()).production.settings;
  await local(async (provider, signer) => {
    for (const optimizer of [settings.optimizer, { enabled: false }]) {
      const compiled = compile('Solidity', source, { ...settings, optimizer }, 'Regression');
      const contract = await new ethers.ContractFactory(compiled.abi, compiled.evm.bytecode.object, signer).deploy();
      await contract.waitForDeployment();
      assert.equal(await contract.memoryLoad(0, 0), 67n);
      assert.equal(await contract.memoryLoad(0, 1), 7n);
      assert.equal(await contract.memoryHash(), ethers.keccak256(ethers.zeroPadValue('0x07', 32)));
      assert.equal(await contract.g.staticCall(0, 2, 0xaaaa, 0xbbbb), 0xbbbbn);
      assert.equal(await contract.g.staticCall(0, 3, 0xaaaa, 0xbbbb), 0xaaaan);
      await (await contract.rmw(0, 1)).wait();
      assert.equal(await contract.a(1), 501n);
    }
  });
});

test('mitigation corrects the upstream reassigned-reference storage regression at 40 optimizer runs', async () => {
  // This synthetic fixture demonstrates the compiler defect, not a deployed-contract finding.
  const body = `let i := 0
    if calldataload(0) { i := 1 }
    let i1 := add(i, 0)
    let k := add(i1, 2)
    sstore(k, add(sload(k), calldataload(64)))
    if calldataload(32) { i := add(i, 2) }
    sstore(i, calldataload(96))
    mstore(0, sload(k))
    return(0, 32)`;
  const content = `object "Regression" { code {
    datacopy(0, dataoffset("runtime"), datasize("runtime")) return(0, datasize("runtime"))
  } object "runtime" { code { ${body} } } }`;
  await local(async (provider, signer) => {
    for (const [steps, expected] of [[originalSteps, 11n], [mitigatedSteps, 22n], [':', 22n]]) {
      const compiled = compile('Yul', content, { evmVersion: 'shanghai', optimizer: {
        enabled: true, runs: 40, details: { yulDetails: { optimizerSteps: steps } } } }, 'Regression');
      const receipt = await (await signer.sendTransaction({ data: '0x' + compiled.evm.bytecode.object })).wait();
      const data = ethers.AbiCoder.defaultAbiCoder().encode(['uint256', 'uint256', 'uint256', 'uint256'], [0, 1, 11, 22]);
      assert.equal(BigInt(await provider.call({ to: receipt.contractAddress, data })), expected);
    }
  });
});
