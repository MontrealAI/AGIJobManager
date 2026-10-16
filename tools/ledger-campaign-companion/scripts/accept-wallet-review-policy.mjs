// Offline actual-source compiler acceptance only; no receipts, device or provider.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
import { Wallet } from 'ethers';
import { ALPHA_CURRENT } from '../coordinators/alpha.mjs';
import { observeSource, privateWrite, sha256, readJson } from '../coordinators/common.mjs';
import { proposeWalletBuildPolicy } from '../trust/prepare-wallet-review.mjs';
import { walletDeploymentBinding } from '../verification/wallet-config.mjs';
import { digest } from '../trust/local-build.mjs';

const root=process.env.WALLET_BUILD_ACCEPT_CHECKOUT,output=process.env.WALLET_BUILD_ACCEPT_REPORT,compilerPath=process.env.COMPANION_ACCEPT_SOLJSON,compilerSha256=process.env.COMPANION_ACCEPT_SOLJSON_SHA256;
assert.ok(root&&path.isAbsolute(root)&&output&&path.isAbsolute(output)&&compilerPath&&path.isAbsolute(compilerPath)&&/^[a-f0-9]{64}$/.test(compilerSha256));
const source=observeSource({checkout:root},ALPHA_CURRENT),load=createRequire(path.join(root,'tests/contracts/package.json')),native=load(path.join(root,'tests/contracts/scripts/mainnet-authority.js')),legacy=load(path.join(root,'tests/contracts/scripts/mainnet.js'));
const privateRoot=fs.mkdtempSync(path.join(os.tmpdir(),'offline-wallet-review-policy-'));fs.chmodSync(privateRoot,0o700);
const report={schema:'manual-ledger-wallet-build-policy-acceptance-v1',source,node:process.versions.node,platform:process.platform,scope:'Actual exact Alpha five-contract native plan and full compiler-input/source/artifact closure, offline fixed CAPI rebuild. Synthetic unmined creation-hash labels; not receipt, Mac CLI, wallet, explorer or provider acceptance.',checks:[],networkCalls:0,companionCampaignRequired:false,nativeSigningSessionRequired:false,actorLocksRequired:false,signatures:0,broadcasts:0,canonicalReceiptsVerified:false,activationAuthorized:false};
const codeHashes=()=>Object.fromEntries(['../trust/prepare-wallet-review.mjs','./accept-wallet-review-policy.mjs'].map(name=>[name,sha256(fs.readFileSync(new URL(name,import.meta.url)))]));report.acceptanceCodeSha256=codeHashes();
try{
  const governor='0xd76AD27a1Bcf8652e7e46BE603FA742FD1c10A99',creator=Wallet.createRandom().address,block={number:1,hash:'0x'+'11'.repeat(32)},config={schema:'agialpha.mainnet.config.v2',chainId:1,deployer:creator,nonce:0,block,governor:{kind:'ledger-eoa',address:governor,addressAcknowledgement:governor},dependencies:{},rootOwners:Object.fromEntries(legacy.roots.map(name=>[name,governor])),parameters:{minimumValidatorStake:'10000000000000000000',minimumAgentStake:'10000000000000000000',quorum:2,maximumRiskBps:2000},sender:{mode:'empty-eoa-direct-create.v1'},envelope:{gasLimit:'8000000',maxFeePerGas:'10000000000',maxPriorityFeePerGas:'1000000000',accessList:[]}};
  for(const[name,address]of Object.entries({token:load(path.join(root,'token.config')).AGIALPHA_ADDRESS,ens:legacy.ENS,wrapper:legacy.WRAPPER}))config.dependencies[name]={address,codeHash:'0x'+'22'.repeat(32)};
  const journal={schema:'ethereum.cross-project-nonce-journal.v1',journalId:'OFFLINE-COMPILER-PROPOSAL-ONLY',revision:1,chainId:1,sender:creator,scope:['alpha','jobs','manager'],block,latestNonce:0,pendingNonce:0,allocations:[{project:'alpha',startNonce:0,count:5}]},revision=load(path.join(root,'tests/contracts/scripts/authority-revision.js')).reviewedRevision();
  const plan=await native.makePlan(config,native.compiledContracts(),revision,journal),planPath=privateWrite(privateRoot,plan),nodePath=fs.realpathSync(process.execPath);
  const review={schema:'manual-ledger-wallet-configuration-review-v1',chainId:1,source,governor,planSha256:plan.payloadSha256,creationHashes:Array.from({length:5},(_,index)=>'0x'+sha256('SYNTHETIC_UNMINED_CREATION_'+index)),governanceHashes:[],licenseType:'3',native:{checkout:root,nodePath,nodeVersion:process.versions.node,nodeSha256:sha256(fs.readFileSync(nodePath)),planPath,readRpcUrl:'https://offline.invalid/never-called'}};
  const compiler={kind:'soljson',path:fs.realpathSync(compilerPath),sha256:compilerSha256,version:'0.8.37+commit.f401782d.Emscripten.clang',nodePath,nodeSha256:digest(fs.readFileSync(nodePath)),nodeVersion:process.versions.node},policyDirectory=path.join(privateRoot,'review-policy');fs.mkdirSync(policyDirectory,{mode:0o700});
  const result=proposeWalletBuildPolicy({review,reviewedSha256:digest(review),compiler,privateDirectory:policyDirectory});
  assert.equal(result.state,'UNAPPROVED_OWNER_REVIEW_REQUIRED');assert.equal(result.creationCount,5);assert.equal(result.policy.campaignSha256,walletDeploymentBinding(review));assert.equal(result.receipt.locallyRecompiled,true);assert.equal(result.receipt.builds.length,1);assert.equal(result.canonicalReceiptsVerified,false);assert.equal(result.companionCampaignRequired,false);assert.equal(result.signingSupported,false);assert.equal(result.relaySupported,false);
  report.checks.push('Actual exact native Alpha plan validated offline and all five contracts locally recompiled against independently pinned official compiler/source/artifact bytes without any seven-step signing campaign');
  const changed=structuredClone(review);changed.governanceHashes=['0x'+'33'.repeat(32)];assert.equal(walletDeploymentBinding(changed),walletDeploymentBinding(review));report.checks.push('Stable deployment binding survives separately supplied governor-receipt progress; no new signing session or actor lock required');
  const unknown=structuredClone(review);unknown.source.commit='a'.repeat(40);assert.throws(()=>proposeWalletBuildPolicy({review:unknown,reviewedSha256:digest(unknown),compiler,privateDirectory:policyDirectory}));report.checks.push('Unsupported source rejected before compiler/input output mutation');
  assert.deepEqual(readJson(planPath),plan);assert.deepEqual(codeHashes(),report.acceptanceCodeSha256);
  report.localBuildReceipt=result.receipt;report.result='PASS';
}catch(error){report.result='FAIL';report.errorCode=/^[A-Z0-9_]{1,96}$/.test(error.code||'')?error.code:'OFFLINE_BUILD_ACCEPTANCE_STOP';process.exitCode=1;}
finally{fs.writeFileSync(output,JSON.stringify(report),{flag:'wx',mode:0o600});fs.rmSync(privateRoot,{recursive:true,force:true});}
process.stdout.write(JSON.stringify({result:report.result,checks:report.checks.length,report:output})+'\n');
