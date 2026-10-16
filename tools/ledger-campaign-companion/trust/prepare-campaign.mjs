import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { Transaction, getAddress, keccak256 } from 'ethers';
import manager, { MANAGER_CURRENT } from '../coordinators/manager.mjs';
import alpha, { ALPHA_CURRENT } from '../coordinators/alpha.mjs';
import { execute, privateWrite, readJson, observeSource, sha256, canonical } from '../coordinators/common.mjs';
import { assertCampaignUnstartedForReplacement, assertTrustedSigningHost } from './local-build.mjs';
import { policyDigest, validateIntent } from '../src/envelope.mjs';
import { registerActorLockDirectory } from '../bridge/actor-lock-policy.mjs';

const GOVERNOR = getAddress('0xd76AD27a1Bcf8652e7e46BE603FA742FD1c10A99');
const packageRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const stop = code => { throw Object.assign(new Error(code), { code }); };
const need = (value, code) => { if (!value) stop(code); };
const clone = value => JSON.parse(JSON.stringify(value));
const same = (a, b) => JSON.stringify(canonical(a)) === JSON.stringify(canonical(b));
function privateDirectory(directory) { need(path.isAbsolute(directory) && fs.realpathSync(directory) === directory, 'SELECTION_PRIVATE_DIRECTORY_REQUIRED'); const stat = fs.lstatSync(directory); need(stat.isDirectory() && (stat.mode & 0o077) === 0 && (typeof process.getuid !== 'function' || stat.uid === process.getuid()), 'SELECTION_PRIVATE_DIRECTORY_REQUIRED'); }
function readPrivate(filename) { const stat = fs.lstatSync(filename); need(path.isAbsolute(filename) && fs.realpathSync(filename) === filename && stat.isFile() && !stat.isSymbolicLink() && stat.size <= 2 * 1024 * 1024 && (stat.mode & 0o077) === 0 && (typeof process.getuid !== 'function' || stat.uid === process.getuid()), 'SELECTION_PRIVATE_FILE_REQUIRED'); return readJson(filename); }

// A fixed command reuses the exact reviewed native planner, read-only transport,
// actor locks and preflight. It has no signing, import, relay or session-start branch.
const NATIVE_SELECTION = String.raw`(async()=>{
const fs=require('node:fs'),path=require('node:path');
const request=JSON.parse(fs.readFileSync(process.argv[1],'utf8')),root=request.checkout,id=request.adapter;
if(!['manager','alpha'].includes(id))throw Error('SELECTION_ADAPTER');
const E=require(require.resolve('ethers',{paths:[path.join(root,id==='manager'?'':'tests/contracts')]}));
const native=require(path.join(root,id==='manager'?'hardhat/scripts/core-creation-plan.cjs':'tests/contracts/scripts/mainnet-authority.js'));
const revision=id==='manager'?native.observedRevision():require(path.join(root,'tests/contracts/scripts/authority-revision.js')).reviewedRevision();
const original=JSON.parse(fs.readFileSync(request.planPath,'utf8')),config=structuredClone(original.config),creator=E.getAddress(request.creator);
const qualified=id==='manager'?require(path.join(root,'hardhat/scripts/qualified-build-catalog.cjs')).loadQualifiedBuild({catalogPath:request.catalogPath,catalogSha256:request.catalogSha256,buildId:request.buildId,expectedRevision:revision}):undefined;
const compiled=id==='alpha'?native.compiledContracts():undefined;
if(id==='manager')native.checkPlan(original,qualified,revision);else await native.checkPlan(original,undefined,revision);
if((id==='manager'?config.creatorPolicy.mode:config.sender.mode)!=='empty-eoa-direct-create.v1')throw Error('SELECTION_EMPTY_EOA_ONLY');
const governor=id==='manager'?config.governor:config.governor.address;
if(governor.toLowerCase()!=='0xd76ad27a1bcf8652e7e46be603fa742fd1c10a99'||creator===E.getAddress(governor))throw Error('SELECTION_GOVERNOR');
const locks=[],managerLocks=id==='manager'?require(path.join(root,'hardhat/scripts/creator-transaction.cjs')):null,alphaLocks=id==='alpha'?require(path.join(root,'tests/contracts/scripts/authority-session.js')):null;
const actors=[...new Set([creator,governor,id==='manager'?config.creator:config.deployer].map(a=>E.getAddress(a)))].sort((a,b)=>a.toLowerCase().localeCompare(b.toLowerCase()));
try{
for(const actor of actors){if(id==='manager')locks.push(managerLocks.reserveCreator({directory:request.lockDirectory,chainId:1,creator:actor,journalPath:request.requestPath}));else locks.push(...alphaLocks.acquireActors({config:{deployer:actor,governor:{address:actor}}},request.lockDirectory,request.requestPath));}
let journal=id==='alpha'?structuredClone(original.journal):null;
if(id==='manager')config.creator=creator;else{config.deployer=creator;journal.sender=creator;if(journal.allocations.length!==1||journal.allocations[0].project!=='alpha'||journal.allocations[0].count!==5)throw Error('CROSS_PROJECT_JOURNAL_HANDOFF_REQUIRED');}
const bootstrap=id==='manager'?native.makePlan(config,qualified,revision):await native.makePlan(config,compiled,revision,journal);
const transport=require(path.join(root,id==='manager'?'hardhat/scripts/deployment-rpc.cjs':'tests/contracts/scripts/authority-rpc.js'));
let rpc=id==='manager'?transport.createReadRpc(process.env.MANAGER_READ_RPC_URL,{scope:transport.scopeFor(bootstrap)}):transport.createReadOnlyRpc(process.env.ALPHA_READ_ONLY_RPC_URL,transport.scopeForPlan(bootstrap));
if(BigInt(await rpc('eth_chainId',[]))!==1n)throw Error('SELECTION_CHAIN');
const finalized=await rpc('eth_getBlockByNumber',['finalized',false]);if(!finalized||!/^0x[0-9a-fA-F]{64}$/.test(finalized.hash))throw Error('SELECTION_FINALIZED');
const pin={number:Number(BigInt(finalized.number)),hash:finalized.hash};if(!Number.isSafeInteger(pin.number)||pin.number<config.block.number)throw Error('SELECTION_PIN');
const nonce=BigInt(await rpc('eth_getTransactionCount',[creator,'latest'])),pending=BigInt(await rpc('eth_getTransactionCount',[creator,'pending']));
const governorNonce=BigInt(await rpc('eth_getTransactionCount',[governor,'latest'])),governorPending=BigInt(await rpc('eth_getTransactionCount',[governor,'pending']));
if(nonce!==pending||governorNonce!==governorPending||nonce>BigInt(Number.MAX_SAFE_INTEGER-9)||governorNonce>BigInt(Number.MAX_SAFE_INTEGER-2))throw Error('SELECTION_NONCE_RECONCILIATION');
config.nonce=Number(nonce);config.block=pin;
if(id==='alpha'){journal.sender=creator;journal.block=pin;journal.latestNonce=Number(nonce);journal.pendingNonce=Number(nonce);journal.revision+=1;journal.journalId='selection-'+require('node:crypto').randomUUID();journal.allocations=[{project:'alpha',startNonce:Number(nonce),count:5}];}
const plan=id==='manager'?native.makePlan(config,qualified,revision):await native.makePlan(config,compiled,revision,journal);
rpc=id==='manager'?transport.createReadRpc(process.env.MANAGER_READ_RPC_URL,{scope:transport.scopeFor(plan)}):transport.createReadOnlyRpc(process.env.ALPHA_READ_ONLY_RPC_URL,transport.scopeForPlan(plan));
const report=id==='manager'?await require(path.join(root,'hardhat/scripts/core-creation-verifier.cjs')).preflight(plan,qualified,revision,rpc):await native.preflight(plan,rpc,revision,[],journal,[]);
if(report.preflightPassed!==true)throw Error('SELECTION_PREFLIGHT');
const canonical=await rpc('eth_getBlockByNumber',[E.toQuantity(pin.number),false]);if(!canonical||canonical.hash!==pin.hash)throw Error('SELECTION_REORG');
if(id==='manager'){native.checkPlan(plan,qualified,revision);qualified.assertUnchanged();}else await native.checkPlan(plan,undefined,revision);
const write=(filename,value)=>{const fd=fs.openSync(filename,'wx',0o600);try{fs.writeFileSync(fd,JSON.stringify(value));fs.fsyncSync(fd);}finally{fs.closeSync(fd);}const d=fs.openSync(path.dirname(filename),'r');try{fs.fsyncSync(d);}finally{fs.closeSync(d);}};
write(request.outputPlan,plan);write(request.outputReport,report);
console.log(JSON.stringify({planPath:request.outputPlan,reportPath:request.outputReport,creator,creatorNonce:Number(nonce),governorNonce:Number(governorNonce),block:pin,preflightPassed:true,externalTransactions:false}));
}finally{for(const lock of locks.reverse()){if(id==='manager')managerLocks.releaseCreator(lock);else alphaLocks.releaseActor(lock);}}
})().catch(()=>{console.error('CREATOR_SELECTION_NATIVE_READ_ONLY_STOPPED');process.exitCode=1;});`;
export const nativeSelectionQualification = Object.freeze({ command: NATIVE_SELECTION, scope: 'READ_ONLY_PREPARATION_NO_SIGNING_IMPORT_SESSION_OR_RELAY' });

export function deriveSelectedCampaign({ template, plan, creator, governorNonce, outputDirectory }) {
  const selected = getAddress(creator); need(selected !== GOVERNOR && selected !== '0x0000000000000000000000000000000000000000', 'SELECTION_ACTORS_INVALID');
  need(getAddress(template.actors?.governor) === GOVERNOR, 'SELECTION_TEMPLATE_GOVERNOR_MISMATCH');
  const value = clone(template), managerPlan = value.adapter === 'manager', operations = managerPlan ? plan.operations : plan.transactions;
  need(['manager','alpha'].includes(value.adapter) && operations?.length === (managerPlan ? 9 : 5) && Number.isSafeInteger(governorNonce) && governorNonce >= 0, 'SELECTION_PLAN_INVALID');
  const oldConfig = template.__reviewedPlanConfig;
  if (oldConfig) { const expected = clone(oldConfig); if (managerPlan) expected.creator = selected; else expected.deployer = selected; expected.nonce = plan.config.nonce; expected.block = plan.config.block; need(same(expected, plan.config), 'SELECTION_ECONOMIC_POLICY_CHANGED'); }
  need((managerPlan ? plan.creator : plan.config.deployer) === selected && (managerPlan ? plan.governor : plan.config.governor.address) === GOVERNOR, 'SELECTION_PLAN_ACTORS_MISMATCH');
  value.campaignId = `selection-${crypto.randomUUID()}`; value.actors.creator = selected;
  value.coordinator.planPath = path.join(outputDirectory, 'selected-plan.json'); value.coordinator.sessionPath = path.join(outputDirectory, managerPlan ? 'native-session' : 'native-session.json');
  value.reviewedManifest.planSha256 = plan.payloadSha256; value.reviewedManifest.sourceSha256 = '0x' + sha256(JSON.stringify(canonical({ source: value.reviewedManifest.source, planSha256: plan.payloadSha256 })));
  const envelopes = operations.map(operation => { const { from, ...envelope } = operation.envelope; need(getAddress(from) === selected, 'SELECTION_CREATION_SENDER_MISMATCH'); return { sender: selected, envelope }; });
  if (!managerPlan) for (const [offset, call] of plan.governanceCalls.entries()) {
    const old = Transaction.from(template.reviewedManifest.operations[5 + offset].unsignedHex);
    envelopes.push({ sender: GOVERNOR, envelope: { type: 2, chainId: 1, nonce: governorNonce + offset, to: call.to, value: '0', data: call.data, gasLimit: old.gasLimit.toString(), maxFeePerGas: old.maxFeePerGas.toString(), maxPriorityFeePerGas: old.maxPriorityFeePerGas.toString(), accessList: [] } });
  }
  need(envelopes.length === template.reviewedManifest.operations.length, 'SELECTION_OPERATION_COUNT_MISMATCH');
  value.reviewedManifest.operations = envelopes.map(({ sender, envelope }, index) => {
    const old = template.reviewedManifest.operations[index], tx = Transaction.from(envelope), operationId = `${value.adapter}-${plan.payloadSha256.slice(0,16)}-${index}`;
    const review = { ...old.review, expectedSender: sender, operationId, sourceSha256: value.reviewedManifest.sourceSha256 };
    const unsignedHex = tx.unsignedSerialized, expectedUnsignedHash = keccak256(unsignedHex), expectedPolicyHash = policyDigest(review, expectedUnsignedHash);
    validateIntent(unsignedHex, expectedUnsignedHash, review, expectedPolicyHash);
    return { operationId, unsignedHex, expectedUnsignedHash, expectedPolicyHash, review };
  });
  value.operations = value.reviewedManifest.operations.map((operation, index) => ({ index, purpose: index < operations.length ? `${operations[index].name} — CREATE` : `${plan.governanceCalls[index - operations.length].name} — ${plan.governanceCalls[index - operations.length].method}`, account: index < operations.length ? 'creator' : 'governor', destination: Transaction.from(operation.unsignedHex).to || 'CREATE', dependsOn: Array.from({ length: index }, (_, earlier) => earlier), decodedArguments: index < operations.length ? clone(operations[index].constructorArguments) : [plan.governanceCalls[index - operations.length].argument], expectedPostState: { status: 'REQUIRES_FRESH_NATIVE_INSPECTION' } }));
  value.relayPolicy = { enabled: false, acknowledgementMode: 'EXACT_COORDINATOR_PER_STEP' };
  if (value.verification) delete value.verification.serviceAuthorization;
  delete value.__reviewedPlanConfig;
  return value;
}

export async function prepareSelectedCampaign({ campaignPath, reviewedCampaignSha256, creator, priorStateDirectory, outputDirectory }) {
  assertTrustedSigningHost(); privateDirectory(outputDirectory); need(typeof priorStateDirectory === 'string' && path.isAbsolute(priorStateDirectory) && path.resolve(priorStateDirectory) === priorStateDirectory, 'SELECTION_ORIGINAL_STATE_PATH_REQUIRED'); need(outputDirectory !== packageRoot && !outputDirectory.startsWith(packageRoot + path.sep), 'SELECTION_OUTPUT_ISOLATION_REQUIRED'); need(fs.readdirSync(outputDirectory).length === 0, 'SELECTION_FRESH_OUTPUT_DIRECTORY_REQUIRED');
  const template = readPrivate(campaignPath); need(/^[a-f0-9]{64}$/.test(reviewedCampaignSha256) && sha256(JSON.stringify(canonical(template))) === reviewedCampaignSha256, 'SELECTION_INDEPENDENT_REVIEW_REQUIRED');
  const base = { manager, alpha }[template.adapter]; need(base, 'SELECTION_ARCHITECTURE_UNSUPPORTED'); const adapter = base.forCampaign(template), supported = adapter.supported;
  need(supported.commit === (template.adapter === 'manager' ? MANAGER_CURRENT.commit : ALPHA_CURRENT.commit), 'SELECTION_CURRENT_NATIVE_REVISION_REQUIRED');
  const selected = getAddress(creator); need(selected !== GOVERNOR && selected !== '0x0000000000000000000000000000000000000000', 'SELECTION_ACTORS_INVALID');
  need(!outputDirectory.startsWith(template.coordinator.checkout + path.sep) && outputDirectory !== priorStateDirectory && !outputDirectory.startsWith(priorStateDirectory + path.sep), 'SELECTION_OUTPUT_ISOLATION_REQUIRED');
  const guard = () => assertCampaignUnstartedForReplacement({ privateDirectory: priorStateDirectory, nativeSessionPath: template.coordinator.sessionPath }); guard();
  const originalInspection = adapter.inspectCampaign(template);
  need(getAddress(originalInspection.creator) === getAddress(template.actors.creator) && getAddress(originalInspection.governor) === GOVERNOR && getAddress(template.actors.governor) === GOVERNOR, 'SELECTION_TEMPLATE_ACTOR_MISMATCH');
  need(getAddress(originalInspection.route.address) === getAddress(template.route.token) && originalInspection.route.decimals === template.route.decimals && originalInspection.route.token.replace(/^\$/,'') === template.route.symbol.replace(/^\$/,''), 'SELECTION_TEMPLATE_ROUTE_MISMATCH');
  const originalPlan = readJson(template.coordinator.planPath); observeSource(template.coordinator, supported);
  need((template.adapter === 'manager' ? originalPlan.config.creatorPolicy.mode : originalPlan.config.sender.mode) === 'empty-eoa-direct-create.v1', 'SELECTION_EMPTY_EOA_ONLY');
  await registerActorLockDirectory({ directory: template.coordinator.lockDirectory }); guard();
  const request = { adapter: template.adapter, checkout: template.coordinator.checkout, creator: selected, planPath: template.coordinator.planPath, lockDirectory: template.coordinator.lockDirectory, catalogPath: template.coordinator.catalogPath, catalogSha256: template.coordinator.catalogSha256, buildId: template.coordinator.buildId, outputPlan: path.join(outputDirectory,'selected-plan.json'), outputReport: path.join(outputDirectory,'native-read-only-preflight.json') };
  const requestPath = path.join(outputDirectory, 'selection-request.json'); request.requestPath = requestPath; privateWrite(outputDirectory, request, '.json', 'selection-request.json');
  const output = await execute(template.coordinator, supported, '-e', [NATIVE_SELECTION, requestPath], template.adapter === 'manager' ? { MANAGER_READ_RPC_URL: template.coordinator.readRpcUrl } : { ALPHA_READ_ONLY_RPC_URL: template.coordinator.readRpcUrl });
  const observation = JSON.parse(output); guard(); need(observation.preflightPassed === true && observation.externalTransactions === false && observation.creator === selected, 'SELECTION_NATIVE_RESULT_INVALID');
  const plan = readJson(request.outputPlan), input = { ...template, __reviewedPlanConfig: originalPlan.config }, campaign = deriveSelectedCampaign({ template: input, plan, creator: selected, governorNonce: observation.governorNonce, outputDirectory });
  const inspection = adapter.inspectCampaign(campaign);
  campaign.operations.forEach((operation, index) => { const actual = inspection.graph?.[index] || inspection.governanceBindings?.[index - inspection.graph.length]; if (actual) { operation.decodedArguments = clone(actual.constructorArguments || actual.arguments || [actual.argument]); operation.expectedPostState = clone(actual.expectedPostState || { status:'NOT_SUPPLIED_BY_NATIVE_COORDINATOR' }); } });
  guard(); privateWrite(outputDirectory, campaign, '.json', 'selected-campaign.json');
  const report = { schema:'manual-ledger-creator-selection-report-v1', state:'UNAPPROVED_OWNER_REVIEW_REQUIRED', source:campaign.reviewedManifest.source, creator:selected, governor:GOVERNOR, campaignPath:path.join(outputDirectory,'selected-campaign.json'), campaignIntegritySha256:sha256(JSON.stringify(canonical(campaign))), planSha256:plan.payloadSha256, operationCount:campaign.operations.length, nativeReadOnlyPreflight:true, originalCampaignChanged:false, configurationPath:'OWNER_SELECTED_EXTERNAL_WALLET_PRIMARY', customCompanionRequiredForConfiguration:false, relayAuthorized:false, signingRequested:false, physicalQualified:false, activationAuthorized:false };
  privateWrite(outputDirectory, report, '.json','selection-report.json'); return report;
}

const usage = 'node trust/prepare-campaign.mjs --campaign ABS_PRIVATE_REVIEWED_CAMPAIGN --reviewed-campaign-sha256 EXACT_REVIEW_DIGEST --creator CHECKSUMMED_SELECTED_DEPLOYER --prior-state ABS_ORIGINAL_CAMPAIGN_STATE --output-directory ABS_FRESH_PRIVATE_DIRECTORY';
async function main() { const args=process.argv.slice(2); if(args.length===1&&args[0]==='--help'){process.stdout.write(usage+'\n');return;} const values={}; for(let i=0;i<args.length;i+=2){need(['--campaign','--reviewed-campaign-sha256','--creator','--prior-state','--output-directory'].includes(args[i])&&!Object.hasOwn(values,args[i])&&typeof args[i+1]==='string'&&!args[i+1].startsWith('--'),'SELECTION_ARGUMENTS_INVALID');values[args[i]]=args[i+1];} need(Object.keys(values).length===5,'SELECTION_ARGUMENTS_INVALID'); const result=await prepareSelectedCampaign({campaignPath:values['--campaign'],reviewedCampaignSha256:values['--reviewed-campaign-sha256'],creator:values['--creator'],priorStateDirectory:values['--prior-state'],outputDirectory:values['--output-directory']});process.stdout.write(JSON.stringify(result)+'\n'); }
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)main().catch(()=>{process.stderr.write('CREATOR_SELECTION_BLOCKED: preserve original campaign, intent, capabilities and actor locks; reconcile before replacing any outstanding state.\n');process.exitCode=1;});
