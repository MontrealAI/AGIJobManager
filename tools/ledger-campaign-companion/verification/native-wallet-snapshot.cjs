'use strict';
// Fixed read-only Alpha path. No wallet, signature import, relay or generic RPC API.
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const { pathToFileURL } = require('node:url');
const [root, planPath, reviewPath, output] = process.argv.slice(2);
const canonical = value => Array.isArray(value) ? value.map(canonical) : value && typeof value === 'object' ? Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])])) : value;
const digest = value => crypto.createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex');
const need = value => { if (!value) throw Error('WALLET_NATIVE_READ_STOPPED'); };
function read(filename) { const stat = fs.lstatSync(filename); need(stat.isFile() && !stat.isSymbolicLink() && stat.size <= 32 * 1024 * 1024 && fs.realpathSync(filename) === filename); return JSON.parse(fs.readFileSync(filename)); }
async function main() {
  need(process.argv.length === 6 && path.isAbsolute(root) && path.isAbsolute(planPath) && path.isAbsolute(reviewPath) && path.isAbsolute(output));
  const plan = read(planPath), review = read(reviewPath), E = require(path.join(root, 'tests/contracts/node_modules/ethers'));
  const p = require(path.join(root, 'tests/contracts/scripts/mainnet-authority.js'));
  const revision = require(path.join(root, 'tests/contracts/scripts/authority-revision.js')).reviewedRevision();
  const source = { repository: 'MontrealAI/AGI-Alpha-Agent-v0', commit: revision.commit, tree: revision.tree };
  need(source.commit === '38064bec3423218f87c6b81760ac6768b3e7d4e5' && source.tree === '4fe59cb9b8c7e65ea087fd27b0e2abed6bf34c68' && digest(source) === digest(review.source) && plan.payloadSha256 === review.planSha256 && plan.config.governor.address === '0xd76AD27a1Bcf8652e7e46BE603FA742FD1c10A99');
  await p.checkPlan(plan, undefined, revision);
  need(Array.isArray(review.creationHashes) && review.creationHashes.length === 5 && Array.isArray(review.governanceHashes) && review.governanceHashes.length <= 2);
  const transport = require(path.join(root, 'tests/contracts/scripts/authority-rpc.js'));
  const rpc = transport.createReadOnlyRpc(process.env.ALPHA_READ_ONLY_RPC_URL, transport.scopeForPlan(plan), { limits: { requests: 1500, deadlineMs: 120000, timeoutMs: 10000 } });
  // This verifies five exact receipts, bytecode/getters, actual binding prefix,
  // ordering, nonce continuity and complete fresh-graph event interval. No session
  // journal or signed capability is imported or marked complete.
  const preflight = await p.preflight(plan, rpc, revision, review.creationHashes, plan.journal, review.governanceHashes);
  const proof = preflight.progress, pin = { number: preflight.observedAtBlock.number, hash: preflight.observedAtBlock.hash };
  const exporter = require(path.join(root, 'tests/contracts/scripts/authority-verification-package.js'));
  const nativeBundle = await exporter.plannedPackage(plan, revision);
  const packagePath = path.join(path.dirname(output), `${crypto.randomUUID()}-five-create-source-package`);
  exporter.writePackage(nativeBundle, packagePath);
  const expectedState = p.expectedState(plan, review.governanceHashes.length), tasks = [], runtimeEvidence = [];
  const { validateWalletReceipt, walletConfigurationCalls } = await import(pathToFileURL(path.join(__dirname, 'wallet-configuration.mjs')).href);
  const calls = walletConfigurationCalls({ source, governor: plan.config.governor.address, graph: plan.addresses });
  for (const [index, name] of p.NAMES.entries()) {
    const contract = nativeBundle.manifest.contracts[name], record = plan.contracts[name], build = plan.builds[record.buildId], creation = proof[index];
    const standardInput = JSON.parse(nativeBundle.files[`${name}/standard-input.json`]);
    const task = { schema: 'manual-ledger-verification-task-v1', chainId: 1, address: plan.addresses[name], qualifiedName: contract.qualifiedName, compilerVersion: contract.compiler, standardInput, standardInputSha256: digest(standardInput), constructorArguments: nativeBundle.files[`${name}/constructor-arguments.txt`].trim(), libraries: standardInput.settings.libraries || {}, creation: { transactionHash: creation.transactionHash, blockHash: creation.block.hash, blockNumber: creation.block.number, canonical: true, finalized: true, runtimeVerified: true }, licenseType: review.licenseType };
    const directory = path.join(root, 'tests/contracts/artifacts/contracts/ascension', `${name}.sol`), debug = read(path.join(directory, `${name}.dbg.json`)), fullBuild = read(path.resolve(directory, debug.buildInfo));
    need(fullBuild.id === record.buildId && build.compiler === fullBuild.solcLongVersion);
    const immutableValues = {};
    for (const id of Object.keys(record.immutableReferences)) { const getter = record.immutableGetters[id]; need(Object.hasOwn(expectedState[name], getter)); immutableValues[id] = E.zeroPadValue(E.toBeHex(BigInt(expectedState[name][getter])), 32); }
    const actualRuntime = await rpc('eth_getCode', [task.address, E.toQuantity(pin.number)]);
    runtimeEvidence.push({ schema: 'manual-ledger-runtime-evidence-v1', chainId: 1, address: task.address, source, qualifiedName: task.qualifiedName, compilerVersion: task.compilerVersion, standardInputSha256: task.standardInputSha256, compilerOutputSha256: digest(fullBuild.output), runtimeTemplate: record.runtime, linkReferences: fullBuild.output.contracts[record.sourceName][name].evm.deployedBytecode.linkReferences || {}, libraries: task.libraries, immutableReferences: record.immutableReferences, immutableValues, actualRuntime, creation: { transactionHash: creation.transactionHash, blockHash: creation.block.hash, blockNumber: creation.block.number }, observedBlock: pin });
    tasks.push(task);
  }
  const governanceReceipts = [];
  for (const [index, txHash] of review.governanceHashes.entries()) {
    const binding = preflight.bindings[index], call = calls[index], tag = E.toQuantity(binding.block.number);
    await p.verifyContract(plan, call.contract, rpc, binding.block, index + 1);
    const transaction = await rpc('eth_getTransactionByHash', [txHash]), receipt = await rpc('eth_getTransactionReceipt', [txHash]);
    const abi = new E.Interface(plan.contracts[call.contract].abi), raw = await rpc('eth_call', [{ to: call.to, data: abi.encodeFunctionData(call.expectedPostState.getter) }, tag]);
    const actualRuntime = await rpc('eth_getCode', [call.to, tag]);
    governanceReceipts.push(validateWalletReceipt({ call, transaction, receipt, canonicalBlock: binding.block, expectedRuntimeCodeHash: E.keccak256(p.expectedRuntime(plan.contracts[call.contract], p.expectedState(plan, index + 1)[call.contract])), actualRuntime, observedGetter: abi.decodeFunctionResult(call.expectedPostState.getter, raw)[0] }));
  }
  const end = await rpc('eth_getBlockByNumber', [E.toQuantity(pin.number), false]); need(end?.hash === pin.hash);
  need(BigInt(await rpc('eth_chainId', [])) === 1n);
  await p.checkPlan(plan, undefined, require(path.join(root, 'tests/contracts/scripts/authority-revision.js')).reviewedRevision());
  const report = { schema: 'manual-ledger-wallet-native-snapshot-v1', chainId: 1, source, planSha256: plan.payloadSha256, graph: plan.addresses, creator: plan.config.deployer, governor: plan.config.governor.address, creationHashes: review.creationHashes, governanceHashes: review.governanceHashes, snapshot: pin, tasks, runtimeEvidence, governanceReceipts, nativePackagePath: packagePath, nativePackageScope: 'Predicted native package preserved unchanged; independently receipt-proven five-CREATE/runtime evidence supplied separately before any binding', nativePreflightPassed: true, noNativeSigningSessionRequired: true, externalTransactions: false, authorityComplete: false, comprehensiveAuthorityComplete: false, activationReady: false };
  const fd = fs.openSync(output, fs.constants.O_CREAT | fs.constants.O_EXCL | fs.constants.O_WRONLY | fs.constants.O_NOFOLLOW, 0o600); try { fs.writeFileSync(fd, JSON.stringify(report)); fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
  console.log('Read-only five-CREATE wallet configuration snapshot retained privately.');
}
main().catch(() => { console.error('WALLET_NATIVE_READ_STOPPED: preserve the input and reconcile any known or uncertain wallet transaction; no submission was attempted.'); process.exitCode = 1; });
