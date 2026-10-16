'use strict';
// Private, fixed native adapter subprocess. No signer, relay or explorer capability.
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const [kind, root, planPath, proofPath, output, catalog, catalogSha, buildId] = process.argv.slice(2);
const stable = value => JSON.stringify(Array.isArray(value) ? value.map(canonical) : canonical(value));
function canonical(value) { return Array.isArray(value) ? value.map(canonical) : value && typeof value === 'object' ? Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])])) : value; }
const digest = value => crypto.createHash('sha256').update(stable(value)).digest('hex');
const need = condition => { if (!condition) throw Error('NATIVE_RUNTIME_SNAPSHOT_STOPPED'); };
const read = file => JSON.parse(fs.readFileSync(file));
async function main() {
  need(['manager', 'alpha'].includes(kind));
  const plan = read(planPath), proofs = read(proofPath), rows = [];
  if (kind === 'manager') {
    const P = require(path.join(root, 'hardhat/scripts/core-creation-plan.cjs'));
    const source = P.observedRevision();
    const q = require(path.join(root, 'hardhat/scripts/qualified-build-catalog.cjs')).loadQualifiedBuild({ catalogPath: catalog, catalogSha256: catalogSha, buildId, expectedRevision: source });
    P.checkPlan(plan, q, source); need(proofs.length === 9);
    const transport = require(path.join(root, 'hardhat/scripts/deployment-rpc.cjs'));
    const rpc = transport.createReadRpc(process.env.MANAGER_READ_RPC_URL, { scope: transport.scopeFor(plan) });
    for (const [i, op] of plan.operations.entries()) {
      const proof = proofs[i], record = q.records[op.name], artifact = record.artifact;
      need(proof.index === i && proof.address === op.predictedAddress);
      const reader = require(path.join(root, 'hardhat/scripts/canonical-state.cjs')).createCanonicalReader({ send: rpc }, proof.block);
      const actualRuntime = await reader.getCode(op.predictedAddress), immutableValues = {};
      for (const id of Object.keys(record.immutableReferences)) {
        const value = op.name === 'AGIJobManager' && Object.keys(record.immutableReferences).length === 1 ? plan.config.constructorArgs.usdcTokenAddress : id === 'library_deploy_address' ? op.predictedAddress : null;
        need(value); immutableValues[id] = '0x' + value.slice(2).toLowerCase().padStart(64, '0');
      }
      rows.push({ address: op.predictedAddress, compilerOutputSha256: q.outputSha256, runtimeTemplate: artifact.deployedBytecode,
        linkReferences: artifact.deployedLinkReferences || {}, immutableReferences: record.immutableReferences, immutableValues, actualRuntime,
        observedBlock: proof.block, ...(op.name !== 'AGIJobManager' && artifact.deployedBytecode.slice(2).toLowerCase().startsWith('73' + '00'.repeat(20) + '3014') ? { librarySelfAddressReference: { start: 1, length: 20 } } : {}) });
    }
    q.assertUnchanged(); P.checkPlan(plan, q, P.observedRevision());
  } else {
    const p = require(path.join(root, 'tests/contracts/scripts/mainnet-authority.js'));
    const revision = require(path.join(root, 'tests/contracts/scripts/authority-revision.js')).reviewedRevision();
    await p.checkPlan(plan, undefined, revision); need(proofs.length === 5);
    const transport = require(path.join(root, 'tests/contracts/scripts/authority-rpc.js'));
    const rpc = transport.createReadOnlyRpc(process.env.ALPHA_READ_ONLY_RPC_URL, transport.scopeForPlan(plan));
    const values = p.expectedState(plan, 0), E = require(path.join(root, 'tests/contracts/node_modules/ethers'));
    for (const [i, name] of p.NAMES.entries()) {
      const record = plan.contracts[name], proof = proofs[i], pin = proof.block;
      need(proof.expectedAddress === plan.addresses[name]);
      const tag = E.toQuantity(pin.number), before = await rpc('eth_getBlockByNumber', [tag, false]);
      need(before?.hash === pin.hash); const actualRuntime = await rpc('eth_getCode', [plan.addresses[name], tag]);
      need((await rpc('eth_getBlockByNumber', [tag, false]))?.hash === pin.hash);
      const directory = path.join(root, 'tests/contracts/artifacts/contracts/ascension', name + '.sol');
      const debug = read(path.join(directory, name + '.dbg.json')), build = read(path.resolve(directory, debug.buildInfo));
      need(build.id === record.buildId); const immutableValues = {};
      for (const id of Object.keys(record.immutableReferences)) {
        const getter = record.immutableGetters[id]; need(Object.hasOwn(values[name], getter));
        immutableValues[id] = E.zeroPadValue(E.toBeHex(BigInt(values[name][getter])), 32);
      }
      rows.push({ address: plan.addresses[name], compilerOutputSha256: digest(build.output), runtimeTemplate: record.runtime,
        linkReferences: build.output.contracts[record.sourceName][name].evm.deployedBytecode.linkReferences || {},
        immutableReferences: record.immutableReferences, immutableValues, actualRuntime, observedBlock: pin });
    }
    await p.checkPlan(plan, undefined, require(path.join(root, 'tests/contracts/scripts/authority-revision.js')).reviewedRevision());
  }
  const fd = fs.openSync(output, fs.constants.O_CREAT | fs.constants.O_EXCL | fs.constants.O_WRONLY | fs.constants.O_NOFOLLOW, 0o600);
  try { fs.writeFileSync(fd, JSON.stringify(rows)); fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
  console.log('Native exact runtime snapshot retained privately.');
}
main().catch(() => { console.error('NATIVE_RUNTIME_SNAPSHOT_STOPPED'); process.exitCode = 1; });
