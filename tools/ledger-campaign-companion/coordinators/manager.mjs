import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { keccak256 } from 'ethers';
import { describeCreation } from '../verification/configuration.mjs';
import { execute, evaluateOffline, need, readJson, sha256, canonical, directory, privateWrite, reviewed, reviewedOperation, comparePacket, validateSignedRaw, publicSummary } from './common.mjs';

export const MANAGER_SUPPORTED = Object.freeze({ id: 'manager', repository: 'MontrealAI/AGIJobManager', commit: 'eb6f725e0b40ac81e50a374304e54a5ff6859fcf', tree: '73347842e4a81767ef14686a607b7aceb4f5d70c', nodeVersions: Object.freeze(['24.19.0']), packetSchema: 'manager-external-signing-handoff-v1', configurationScope: 'Nine core CREATEs only; no governor configuration, ENS changes, funding or activation' });
const COUNT = 9;
function paths(config, privateDir) {
  directory(privateDir, config.checkout); directory(path.dirname(config.sessionPath), config.checkout); directory(config.lockDirectory, config.checkout);
  need(typeof config.catalogSha256 === 'string' && /^[a-f0-9]{64}$/.test(config.catalogSha256) && typeof config.buildId === 'string', 'EXPLICIT_QUALIFIED_CATALOG_REQUIRED');
}
async function command(campaign, privateDir, action, fields = {}) {
  const { config } = reviewed(campaign, MANAGER_SUPPORTED, COUNT); paths(config, privateDir);
  const output = path.join(privateDir, `${crypto.randomUUID()}-manager-${action}.json`);
  const args = [action, '--catalog', config.catalogPath, '--catalog-sha', config.catalogSha256, '--build-id', config.buildId, '--out', output];
  if (action === 'start') args.push('--plan', config.planPath, '--session', config.sessionPath, '--lock-directory', config.lockDirectory);
  else if (action === 'preflight') args.push('--plan', config.planPath);
  else args.push('--session', config.sessionPath);
  for (const [key, value] of Object.entries(fields)) args.push(`--${key}`, value);
  await execute(config, MANAGER_SUPPORTED, path.join(config.checkout, 'hardhat/scripts/core-session.cjs'), args,
    { MANAGER_READ_RPC_URL: config.readRpcUrl, ...(action === 'relay' ? { MANAGER_RELAY_RPC_URL: config.relayRpcUrl } : {}) });
  return readJson(output);
}
async function status(campaign) {
  const { config } = reviewed(campaign, MANAGER_SUPPORTED, COUNT);
  const code = "const path=require('node:path');const root=process.argv[1],session=process.argv[2];const P=require(path.join(root,'hardhat/scripts/core-creation-plan.cjs'));P.observedRevision();const s=require(path.join(root,'hardhat/scripts/deployment-session.cjs')).readSession(session);console.log(JSON.stringify({planSha256:s.plan.payloadSha256,states:s.state.map(x=>({status:x.status,transactionHash:x.transactionHash||null})),released:s.released}));";
  const state = JSON.parse(await execute(config, MANAGER_SUPPORTED, '-e', [code, config.checkout, config.sessionPath]));
  need(state.planSha256 === campaign.reviewedManifest.planSha256 && state.states?.length === COUNT, 'SESSION_PLAN_MISMATCH');
  return state;
}
async function verifyPrefix(campaign) {
  const { config } = reviewed(campaign, MANAGER_SUPPORTED, COUNT);
  const code = "(async()=>{const path=require('node:path');const [root,session,catalog,catalogSha,buildId]=process.argv.slice(1);const P=require(path.join(root,'hardhat/scripts/core-creation-plan.cjs')),source=P.observedRevision();const q=require(path.join(root,'hardhat/scripts/qualified-build-catalog.cjs')).loadQualifiedBuild({catalogPath:catalog,catalogSha256:catalogSha,buildId,expectedRevision:source});const s=require(path.join(root,'hardhat/scripts/deployment-session.cjs')).readSession(session);P.checkPlan(s.plan,q,source);const r=require(path.join(root,'hardhat/scripts/deployment-rpc.cjs'));const rpc=r.createReadRpc(process.env.MANAGER_READ_RPC_URL,{scope:r.scopeFor(s.plan)});const hashes=s.state.filter(x=>x.status==='finalized').map(x=>x.transactionHash);const result=await require(path.join(root,'hardhat/scripts/core-creation-verifier.cjs')).verifyPrefix(s.plan,q,source,rpc,hashes);console.log(JSON.stringify(result));})().catch(()=>{console.error('COORDINATOR_PREFIX_RECHECK_FAILED');process.exitCode=1;});";
  return JSON.parse(await execute(config, MANAGER_SUPPORTED, '-e', [code, config.checkout, config.sessionPath, config.catalogPath, config.catalogSha256, config.buildId], { MANAGER_READ_RPC_URL: config.readRpcUrl }));
}
function expected(state, step, operationId, campaign) {
  need(campaign.reviewedManifest.operations[step]?.operationId === operationId, 'OPERATION_ID_MISMATCH');
  need(state.states.slice(0, step).every(x => x.status === 'finalized'), 'CANONICAL_PREFIX_REQUIRED');
  return state.states[step];
}
export function createManagerAdapter() {
  return Object.freeze({
    id: 'manager', supported: MANAGER_SUPPORTED,
    inspectCampaign(campaign) { const { plan, config } = reviewed(campaign, MANAGER_SUPPORTED, COUNT);
      const code = "const path=require('node:path');const [root,planFile,catalog,catalogSha,buildId]=process.argv.slice(1),P=require(path.join(root,'hardhat/scripts/core-creation-plan.cjs')),source=P.observedRevision(),q=require(path.join(root,'hardhat/scripts/qualified-build-catalog.cjs')).loadQualifiedBuild({catalogPath:catalog,catalogSha256:catalogSha,buildId,expectedRevision:source}),plan=JSON.parse(require('node:fs').readFileSync(planFile));P.checkPlan(plan,q,source);console.log(JSON.stringify(plan.operations.map(x=>({abi:q.records[x.name].artifact.abi,linkedBytecode:P.linkedCreation(q.records[x.name].artifact,plan.libraries).toLowerCase()}))));";
      const records = evaluateOffline(config, MANAGER_SUPPORTED, code, [config.checkout, config.planPath, config.catalogPath, config.catalogSha256, config.buildId]);
      return { ...publicSummary(campaign, MANAGER_SUPPORTED, COUNT), route: { token: 'USDC', decimals: 6, address: plan.config.constructorArgs.usdcTokenAddress }, creator: plan.creator, governor: plan.governor,
      feeWallets: plan.config.constructorArgs.settlementWallets, ensDependencies: plan.config.constructorArgs.ensConfig, maximumTotalFeeWei: plan.config.maximumTotalFeeWei, expiresAfterBlock: plan.config.expiresAfterBlock,
      graph: plan.operations.map((x, index) => ({ name: x.name, address: x.predictedAddress, constructorArguments: x.constructorArguments, libraries: x.libraries,
        ...describeCreation({ unsignedHex: campaign.reviewedManifest.operations[index].unsignedHex, abi: records[index].abi, linkedBytecode: records[index].linkedBytecode, expectedLinkedBytecodeHash: keccak256(records[index].linkedBytecode), constructorArguments: x.constructorArguments }),
        displayScope: 'HOST_DECODED_NOT_DEVICE_CONFIRMED', expectedPostState: { address: x.predictedAddress, runtime: { verification: 'Exact pinned compiler artifact and new-graph library links', qualifiedName: x.qualifiedName, catalogSha256: plan.catalogSha256, buildDigest: plan.buildDigest },
          ...(x.name === 'AGIJobManager' ? { owner: plan.governor, pendingOwner: '0x0000000000000000000000000000000000000000', paused: true, settlementPaused: false, ensJobPages: '0x0000000000000000000000000000000000000000', usdcToken: plan.config.constructorArgs.usdcTokenAddress, wallet30: plan.config.constructorArgs.settlementWallets[0], wallet10: plan.config.constructorArgs.settlementWallets[1], creatorModerator: false, creatorAdditionalAgent: false, creatorAdditionalValidator: false, nextJobId: '0', activationAuthorized: false } : {}) } })) }; },
    async prepare({ campaign, step, privateDir }) {
      const checked = reviewedOperation(campaign, MANAGER_SUPPORTED, COUNT, step); paths(checked.config, privateDir);
      if (!fs.existsSync(checked.config.sessionPath)) await command(campaign, privateDir, 'start');
      const current = expected(await status(campaign), step, checked.operation.operationId, campaign);
      need(current.status === 'planned', 'RECOVERY_REQUIRED_EXISTING_SIGNING_INTENT');
      const packet = await command(campaign, privateDir, 'handoff');
      comparePacket(packet, checked, MANAGER_SUPPORTED, step);
      return { packet, operationId: checked.operation.operationId, prepared: checked.prepared, state: 'awaiting-owner-approval' };
    },
    async importSigned({ campaign, step, operationId, raw, privateDir }) {
      const checked = reviewedOperation(campaign, MANAGER_SUPPORTED, COUNT, step);
      need(operationId === checked.operation.operationId, 'OPERATION_ID_MISMATCH'); paths(checked.config, privateDir);
      const hash = validateSignedRaw(raw, checked.prepared), current = expected(await status(campaign), step, operationId, campaign);
      need(current.status === 'handed-off', 'RECOVERY_REQUIRED_NO_IMPORTABLE_INTENT');
      const signedFile = privateWrite(privateDir, { raw });
      const result = await command(campaign, privateDir, 'import', { 'signed-file': signedFile });
      need(result.index === step && result.transactionHash === hash && typeof result.relayAcknowledgement === 'string', 'COORDINATOR_IMPORT_MISMATCH');
      return { operationId, transactionHash: hash, state: 'signed', acknowledgement: result.relayAcknowledgement };
    },
    async relayOne({ campaign, step, operationId, acknowledgement, privateDir }) {
      const checked = reviewedOperation(campaign, MANAGER_SUPPORTED, COUNT, step); paths(checked.config, privateDir);
      const current = expected(await status(campaign), step, operationId, campaign);
      need(current.status === 'signed', 'RELAY_ALREADY_ATTEMPTED_OR_UNSIGNED');
      const saved = await command(campaign, privateDir, 'retrieve-handoff');
      need(saved.index === step && saved.status === 'signed' && saved.relayAlreadyAttempted === false && saved.relayAcknowledgement === acknowledgement, 'EXACT_COORDINATOR_ACK_REQUIRED');
      await command(campaign, privateDir, 'relay', { acknowledgement });
      return { operationId, transactionHash: current.transactionHash, state: 'submitted', submissionAttempted: true };
    },
    async observe({ campaign, step, operationId, privateDir }) {
      const checked = reviewedOperation(campaign, MANAGER_SUPPORTED, COUNT, step, { allowExpired: true }); paths(checked.config, privateDir);
      let current = expected(await status(campaign), step, operationId, campaign);
      if (current.status === 'planned') return { operationId, state: 'blocked', verified: false, finalized: false };
      if (current.status !== 'finalized') {
        // The genuine verifier rejects missing, pending, changed or nonfinal receipts. No submission occurs here.
        try { await command(campaign, privateDir, 'recover'); } catch {
          if (current.status === 'signed' && !checked.prepared.expired) {
            const original = await command(campaign, privateDir, 'retrieve-handoff');
            if (original.index === step && original.transactionHash === current.transactionHash && original.status === 'signed' && original.relayAlreadyAttempted === false && original.relayAcknowledgement)
              return { operationId, transactionHash: current.transactionHash, state: 'signed', verified: false, finalized: false, relayAlreadyAttempted: false, canonicalReceipt: 'NOT_ESTABLISHED', signingAuthorization: false };
          }
          return { operationId, transactionHash: current.transactionHash, state: 'recovery-required', verified: false, finalized: false };
        }
        await command(campaign, privateDir, 'reconcile');
      }
      current = expected(await status(campaign), step, operationId, campaign);
      need(current.status === 'finalized', 'FINALIZED_PREFIX_NOT_RECORDED');
      const prefix = await verifyPrefix(campaign);
      need(prefix.proofs.length > step && prefix.proofs[step].transactionHash === current.transactionHash, 'CANONICAL_PREFIX_NOT_REVERIFIED');
      let completion = null;
      if (step === COUNT - 1) {
        completion = await command(campaign, privateDir, 'complete');
        need(completion.status === 'CORE_CREATED_PAUSED_CONFIGURATION_SEPARATE' && completion.activationAuthorized === false && completion.proofs?.length === COUNT, 'BOUNDED_COMPLETION_MISMATCH');
      }
      return { operationId, transactionHash: current.transactionHash, state: 'verified', verified: true, finalized: true, operationCount: COUNT, activationAllowed: false,
        configurationComplete: false, comprehensiveAuthorityComplete: false, ...(completion ? { boundedCampaignComplete: true, completionStatus: completion.status } : {}) };
    },
    async exportVerification({ campaign, step, privateDir }) {
      need(step === COUNT - 1, 'VERIFICATION_EXPORT_AWAITS_ALL_NINE_CREATIONS');
      const checked = reviewedOperation(campaign, MANAGER_SUPPORTED, COUNT, step, { allowExpired: true }); paths(checked.config, privateDir);
      need(typeof checked.config.licenseType === 'string' && /^[1-9][0-9]?$/.test(checked.config.licenseType), 'EXPLICIT_EXPLORER_LICENSE_REQUIRED');
      need((await status(campaign)).states.every(x => x.status === 'finalized'), 'ALL_NINE_FINALIZED_RECEIPTS_REQUIRED');
      const proof = await verifyPrefix(campaign); need(proof.proofs.length === COUNT, 'COMPLETE_CANONICAL_PREFIX_REQUIRED');
      const packagePath = path.join(privateDir, `${crypto.randomUUID()}-manager-verification`), config = checked.config;
      await execute(config, MANAGER_SUPPORTED, path.join(config.checkout, 'hardhat/scripts/export-verification-package.cjs'), ['--catalog', config.catalogPath, '--catalog-sha256', config.catalogSha256, '--build-id', config.buildId, '--plan', config.planPath, '--output', packagePath, '--source-root', config.checkout]);
      const manifest = readJson(path.join(packagePath, 'manifest.json'));
      need(manifest.schema === 'manager-offline-verification-package-v1' && manifest.receiptProven === false, 'NATIVE_EXPORT_SCOPE_MISMATCH');
      const tasks = manifest.contracts.map((contract, index) => {
        const creation = proof.proofs[index], standardInput = readJson(path.join(packagePath, contract.compilerInput.filename));
        need(creation.index === index && creation.address === contract.predictedAddress, 'EXPORTED_RECEIPT_ADDRESS_MISMATCH');
        return { schema: 'manual-ledger-verification-task-v1', chainId: 1, address: creation.address, qualifiedName: contract.qualifiedName, compilerVersion: contract.compilerVersion, standardInput,
          standardInputSha256: sha256(JSON.stringify(canonical(standardInput))), constructorArguments: contract.constructor.etherscanHexWithoutPrefix, libraries: contract.libraries,
          creation: { transactionHash: creation.transactionHash, blockHash: creation.block.hash, blockNumber: creation.block.number, canonical: true, finalized: true, runtimeVerified: true }, licenseType: config.licenseType };
      });
      return { tasks, packagePath, nativePackageScope: 'Predicted export retained unchanged; canonical receipt proof separately reverified', explorerAcceptance: 'NOT_OBSERVED', activationAllowed: false };
    }
  });
}
export default createManagerAdapter();
