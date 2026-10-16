import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { Transaction } from 'ethers';
import { describeCreation, decodeSupportedBinding } from '../verification/configuration.mjs';
import { keccak256 } from 'ethers';
import { execute, evaluateOffline, need, readJson, ordinary, sha256, canonical, directory, privateWrite, reviewed, reviewedOperation, comparePacket, validateSignedRaw, publicSummary } from './common.mjs';

export const ALPHA_SUPPORTED = Object.freeze({ id: 'alpha', repository: 'MontrealAI/AGI-Alpha-Agent-v0', commit: 'd69cdd3ddc0f36933d07f0f64abfe15e742bf68c', tree: '721aae37b0f337029de98325d6ba3de1b1b1a7bd', nodeVersions: Object.freeze(['22.17.1']), packetSchema: 'agialpha.external-signing-handoff.v1', configurationScope: 'Five direct CREATEs and only bindMarketplace + bindMark on the new receipt-proven graph' });
const COUNT = 7;
function paths(config, privateDir) {
  directory(privateDir, config.checkout); directory(path.dirname(config.sessionPath), config.checkout); directory(config.lockDirectory, config.checkout);
  need(config.mode === 'raw-relay', 'ALPHA_EXPLICIT_RAW_RELAY_MODE_REQUIRED');
}
async function command(campaign, privateDir, action, fields = {}) {
  const { config } = reviewed(campaign, ALPHA_SUPPORTED, COUNT); paths(config, privateDir);
  const input = privateWrite(privateDir, { plan: config.planPath, journal: config.sessionPath, ...fields });
  const output = path.join(privateDir, `${crypto.randomUUID()}-alpha-${action}.json`);
  await execute(config, ALPHA_SUPPORTED, path.join(config.checkout, 'tests/contracts/scripts/authority-session.js'), [action, input, output],
    { DEPLOYMENT_LOCK_DIRECTORY: config.lockDirectory, ALPHA_READ_ONLY_RPC_URL: config.readRpcUrl,
      ...(action === 'relay' ? { ALPHA_RAW_RELAY_RPC_URL: config.relayRpcUrl, ALPHA_ENABLE_USER_RUN_RAW_RELAY: 'I_REVIEWED_THIS_EXACT_TRANSACTION' } : {}) });
  return readJson(output);
}
function expected(report, step, operationId, campaign) {
  const state = report.state;
  need(state?.schema === 'agialpha.new-graph-session.v1' && state.planSha256 === campaign.reviewedManifest.planSha256, 'SESSION_PLAN_MISMATCH');
  need(campaign.reviewedManifest.operations[step]?.operationId === operationId && state.operations?.slice(0, step).length === step && state.operations.slice(0, step).every(x => x.status === 'finalized'), 'CANONICAL_PREFIX_REQUIRED');
  need(!report.commandBlocked, 'COORDINATOR_COMMAND_GATE_REQUIRES_RECOVERY');
  return state.operations[step];
}
async function preflight(campaign, privateDir, state) {
  const { config, plan } = reviewed(campaign, ALPHA_SUPPORTED, COUNT), prefix = state.operations.filter(x => x.status === 'finalized');
  const input = privateWrite(privateDir, { creationHashes: prefix.filter(x => x.index < 5).map(x => x.txHash), governanceHashes: prefix.filter(x => x.index >= 5).map(x => x.txHash), journal: plan.journal });
  const output = path.join(privateDir, `${crypto.randomUUID()}-alpha-verified-prefix.json`);
  await execute(config, ALPHA_SUPPORTED, path.join(config.checkout, 'tests/contracts/scripts/authority-cli.js'), ['preflight', config.planPath, input, output], { ALPHA_READ_ONLY_RPC_URL: config.readRpcUrl });
  return readJson(output);
}
export function createAlphaAdapter() {
  return Object.freeze({
    id: 'alpha', supported: ALPHA_SUPPORTED,
    inspectCampaign(campaign) { const { plan, config } = reviewed(campaign, ALPHA_SUPPORTED, COUNT);
      const code = "(async()=>{const path=require('node:path'),[root,planFile]=process.argv.slice(1),p=require(path.join(root,'tests/contracts/scripts/mainnet-authority.js')),revision=require(path.join(root,'tests/contracts/scripts/authority-revision.js')).reviewedRevision(),plan=JSON.parse(require('node:fs').readFileSync(planFile));await p.checkPlan(plan,undefined,revision);const state=p.expectedState(plan,0);console.log(JSON.stringify({unbound:state,one:p.expectedState(plan,1),bound:p.expectedState(plan,2),runtimeHashes:Object.fromEntries(p.NAMES.map(name=>[name,require(path.join(root,'tests/contracts/node_modules/ethers')).keccak256(p.expectedRuntime(plan.contracts[name],state[name]))]))}));})().catch(()=>{console.error('ALPHA_OFFLINE_INSPECTION_FAILED');process.exitCode=1;});";
      const expected = evaluateOffline(config, ALPHA_SUPPORTED, code, [config.checkout, config.planPath]);
      return { ...publicSummary(campaign, ALPHA_SUPPORTED, COUNT), route: { token: '$AGIALPHA', decimals: 18, address: plan.config.dependencies.token.address }, creator: plan.config.deployer, governor: plan.config.governor.address,
      parameters: plan.config.parameters, graph: plan.transactions.map((x, index) => ({ name: x.name, address: x.expectedAddress,
        ...describeCreation({ unsignedHex: campaign.reviewedManifest.operations[index].unsignedHex, abi: plan.contracts[x.name].abi, linkedBytecode: plan.contracts[x.name].bytecode.toLowerCase(), expectedLinkedBytecodeHash: keccak256(plan.contracts[x.name].bytecode), constructorArguments: x.constructorArguments }),
        expectedPostState: { ...expected.unbound[x.name], runtimeCodeHash: expected.runtimeHashes[x.name], afterGovernedBindings: expected.bound[x.name] } })),
      governanceBindings: plan.governanceCalls.map((binding, i) => { const operation = campaign.reviewedManifest.operations[i + 5], tx = Transaction.from(operation.unsignedHex);
        need(tx.to === binding.to && tx.data === binding.data && tx.value === 0n && operation.review.expectedSender === binding.from, 'REVIEWED_BINDING_DIFFERS_FROM_NATIVE_PLAN');
        return { ...binding, ...decodeSupportedBinding(operation.unsignedHex), expectedPostState: i === 0 ? { target: binding.to, getter: 'marketplace', equals: plan.addresses.AscensionJobMarket } : { target: binding.to, getter: 'mark', equals: plan.addresses.AscensionMark } }; }),
      nativePlanExpiry: 'NOT_SUPPORTED_BY_CURRENT_COORDINATOR', wallClockExpiryScope: 'Companion only; an Ethereum signature remains executable after expiry' }; },
    async prepare({ campaign, step, privateDir }) {
      const checked = reviewedOperation(campaign, ALPHA_SUPPORTED, COUNT, step); paths(checked.config, privateDir);
      if (!fs.existsSync(checked.config.sessionPath)) await command(campaign, privateDir, 'start', { mode: 'raw-relay' });
      const current = expected(await command(campaign, privateDir, 'status'), step, checked.operation.operationId, campaign);
      need(!current, 'RECOVERY_REQUIRED_EXISTING_SIGNING_INTENT');
      let governorEnvelope = null;
      if (step >= 5) {
        // Every nonce and fee is taken from the independently reviewed immutable envelope.
        const tx = Transaction.from(checked.operation.unsignedHex);
        governorEnvelope = privateWrite(privateDir, { nonce: tx.nonce, gasLimit: tx.gasLimit.toString(), maxFeePerGas: tx.maxFeePerGas.toString(), maxPriorityFeePerGas: tx.maxPriorityFeePerGas.toString(), accessList: tx.accessList });
      }
      const result = await command(campaign, privateDir, 'prepare', { governorEnvelope });
      comparePacket(result.packet, checked, ALPHA_SUPPORTED, step);
      return { packet: result.packet, operationId: checked.operation.operationId, prepared: checked.prepared, state: 'awaiting-owner-approval' };
    },
    async importSigned({ campaign, step, operationId, raw, privateDir }) {
      const checked = reviewedOperation(campaign, ALPHA_SUPPORTED, COUNT, step); paths(checked.config, privateDir);
      need(operationId === checked.operation.operationId, 'OPERATION_ID_MISMATCH');
      const hash = validateSignedRaw(raw, checked.prepared), current = expected(await command(campaign, privateDir, 'status'), step, operationId, campaign);
      need(current?.status === 'handed-off', 'RECOVERY_REQUIRED_NO_IMPORTABLE_INTENT');
      // Current Alpha requires raw text, unlike Manager's JSON {raw}. This file never leaves private state.
      const filename = `alpha-${checked.manifest.planSha256}-${step}.raw`, existing = path.join(privateDir, filename);
      let signedRawFile;
      if (fs.existsSync(existing)) { need(ordinary(existing, 200002).toString() === raw, 'EXISTING_PRIVATE_CAPABILITY_DIFFERS'); signedRawFile = existing; }
      else signedRawFile = privateWrite(privateDir, raw, '.raw', filename);
      await command(campaign, privateDir, 'import', { signedRawFile });
      const report = await command(campaign, privateDir, 'status'), updated = expected(report, step, operationId, campaign);
      need(updated.status === 'signed' && updated.txHash === hash && typeof report.relayAcknowledgement === 'string', 'COORDINATOR_IMPORT_MISMATCH');
      return { operationId, transactionHash: hash, state: 'signed', acknowledgement: report.relayAcknowledgement };
    },
    async relayOne({ campaign, step, operationId, acknowledgement, privateDir }) {
      const checked = reviewedOperation(campaign, ALPHA_SUPPORTED, COUNT, step); paths(checked.config, privateDir);
      const report = await command(campaign, privateDir, 'status'), current = expected(report, step, operationId, campaign);
      need(current?.status === 'signed' && report.relayAcknowledgement === acknowledgement, 'EXACT_COORDINATOR_ACK_REQUIRED');
      // The original durable raw is retained in private import input, never reconstructed from an untrusted request.
      const signedRawFile = path.join(privateDir, `alpha-${checked.manifest.planSha256}-${step}.raw`);
      need(validateSignedRaw(ordinary(signedRawFile, 200002).toString(), checked.prepared) === current.txHash, 'PRESERVED_PRIVATE_CAPABILITY_REQUIRED');
      await command(campaign, privateDir, 'relay', { signedRawFile, acknowledgement });
      return { operationId, transactionHash: current.txHash, state: 'submitted', submissionAttempted: true };
    },
    async observe({ campaign, step, operationId, privateDir }) {
      const checked = reviewedOperation(campaign, ALPHA_SUPPORTED, COUNT, step, { allowExpired: true }); paths(checked.config, privateDir);
      let report = await command(campaign, privateDir, 'status'), current = expected(report, step, operationId, campaign);
      if (!current) return { operationId, state: 'blocked', verified: false, finalized: false };
      if (current.status !== 'finalized') {
        const result = await command(campaign, privateDir, 'recover', { transactionHash: current.txHash || null });
        if (!result.resolved) return { operationId, transactionHash: current.txHash || null, state: current.status === 'signed' && !checked.prepared.expired ? 'signed' : 'pending', verified: false, finalized: false, canonicalReceipt: 'NOT_ESTABLISHED', signingAuthorization: false };
        await command(campaign, privateDir, 'reconcile', { transactionHash: result.transactionHash });
      }
      report = await command(campaign, privateDir, 'status'); current = expected(report, step, operationId, campaign);
      need(current.status === 'finalized', 'FINALIZED_PREFIX_NOT_RECORDED');
      await preflight(campaign, privateDir, report.state);
      let complete = false;
      if (step === COUNT - 1) {
        const result = await command(campaign, privateDir, 'finish');
        need(result.complete === true || result.state?.complete === true, 'BOUNDED_COMPLETION_MISMATCH'); complete = true;
      }
      return { operationId, transactionHash: current.txHash, state: 'verified', verified: true, finalized: true, operationCount: COUNT,
        boundedCampaignComplete: complete, configurationComplete: complete, comprehensiveAuthorityComplete: false, activationAllowed: false };
    },
    async exportVerification({ campaign, step, privateDir }) {
      need(step === COUNT - 1, 'RECEIPT_PROVEN_EXPORT_AWAITS_ALL_SEVEN_OPERATIONS');
      const checked = reviewedOperation(campaign, ALPHA_SUPPORTED, COUNT, step, { allowExpired: true }); paths(checked.config, privateDir);
      need(typeof checked.config.licenseType === 'string' && /^[1-9][0-9]?$/.test(checked.config.licenseType), 'EXPLICIT_EXPLORER_LICENSE_REQUIRED');
      const completed = await command(campaign, privateDir, 'finish');
      need(completed.state.complete === true && completed.state.operations.length === COUNT && completed.state.operations.every(x => x.status === 'finalized'), 'ALL_SEVEN_FINALIZED_OPERATIONS_REQUIRED');
      const evidencePath = privateWrite(privateDir, { creationHashes: completed.state.operations.slice(0, 5).map(x => x.txHash), governanceHashes: completed.state.operations.slice(5).map(x => x.txHash), acceptanceBlock: completed.evidence.block });
      const packagePath = path.join(privateDir, `${crypto.randomUUID()}-alpha-verification`), config = checked.config;
      await execute(config, ALPHA_SUPPORTED, path.join(config.checkout, 'tests/contracts/scripts/authority-verification-package.js'), ['receipts', config.planPath, evidencePath, packagePath], { ALPHA_READ_ONLY_RPC_URL: config.readRpcUrl });
      const manifest = readJson(path.join(packagePath, 'manifest.json'));
      need(manifest.schema === 'agialpha.explorer-verification-package.v2' && manifest.addressStatus === 'receipt-proven', 'NATIVE_EXPORT_SCOPE_MISMATCH');
      const tasks = Object.entries(manifest.contracts).map(([name, contract]) => {
        const creation = contract.creationEvidence, standardInput = readJson(path.join(packagePath, name, 'standard-input.json'));
        const request = readJson(path.join(packagePath, name, 'etherscan-request.json'));
        need(creation.expectedAddress === contract.address && contract.addressStatus === 'receipt-proven', 'EXPORTED_RECEIPT_ADDRESS_MISMATCH');
        return { schema: 'manual-ledger-verification-task-v1', chainId: 1, address: contract.address, qualifiedName: request.contractname, compilerVersion: request.compilerversion, standardInput,
          standardInputSha256: sha256(JSON.stringify(canonical(standardInput))), constructorArguments: request.constructorArguments, libraries: {},
          creation: { transactionHash: creation.transactionHash, blockHash: creation.block.hash, blockNumber: creation.block.number, canonical: true, finalized: true, runtimeVerified: true }, licenseType: config.licenseType };
      });
      need(tasks.length === 5, 'EXACT_FIVE_CONTRACT_EXPORT_REQUIRED');
      return { tasks, packagePath, nativePackageScope: 'Genuine receipt-proven v2 export; all five creations and both bindings reverified', explorerAcceptance: 'NOT_OBSERVED', activationAllowed: false };
    }
  });
}
export default createAlphaAdapter();
