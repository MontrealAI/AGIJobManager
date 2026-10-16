import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { ALPHA_CURRENT } from '../coordinators/alpha.mjs';
import { evaluateOffline, observeSource, readJson, privateWrite, ordinary } from '../coordinators/common.mjs';
import { validateWalletReview, walletDeploymentBinding, compareLocallyCompiledPlan } from '../verification/wallet-config.mjs';
import { prepareLocalReviewPolicy } from './prepare-review.mjs';
import { assertTrustedSigningHost, reproduceLocalBuild, digest, canonical } from './local-build.mjs';

const packageRoot=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const stop=code=>{throw Object.assign(new Error(code),{code});};
const need=(value,code)=>{if(!value)stop(code);};
const equal=(a,b)=>JSON.stringify(canonical(a))===JSON.stringify(canonical(b));
const nativePlanCheck="(async()=>{const fs=require('node:fs'),path=require('node:path'),[root,filename]=process.argv.slice(1),policy=require(path.join(root,'tests/contracts/scripts/mainnet-authority.js')),revision=require(path.join(root,'tests/contracts/scripts/authority-revision.js')).reviewedRevision(),plan=JSON.parse(fs.readFileSync(filename));await policy.checkPlan(plan,undefined,revision);console.log(JSON.stringify({planSha256:plan.payloadSha256,governor:plan.config.governor.address,creationCount:plan.transactions.length}));})().catch(()=>{console.error('WALLET_LOCAL_NATIVE_PLAN_REJECTED');process.exitCode=1;});";
export const WALLET_BUILD_REVIEW_USAGE='node trust/prepare-wallet-review.mjs --review ABS_PRIVATE_WALLET_REVIEW --reviewed-sha256 INDEPENDENT_REVIEW_DIGEST --compiler ABS_OFFICIAL_SOLJSON --compiler-sha256 INDEPENDENT_COMPILER_DIGEST --node ABS_PINNED_NODE --node-sha256 INDEPENDENT_NODE_DIGEST --out ABS_PRIVATE_NEW_BUILD_POLICY';
export function parseWalletBuildReviewOptions(args){
  if(args.length===1&&args[0]==='--help')return null;
  const values={},keys=['--review','--reviewed-sha256','--compiler','--compiler-sha256','--node','--node-sha256','--out'];
  for(let index=0;index<args.length;index+=2){const key=args[index],value=args[index+1];need(keys.includes(key)&&!Object.hasOwn(values,key)&&typeof value==='string'&&!value.startsWith('--'),'WALLET_BUILD_REVIEW_ARGUMENTS_INVALID');values[key]=value;}
  need(Object.keys(values).length===keys.length&&['--review','--compiler','--node','--out'].every(key=>path.isAbsolute(values[key]))&&['--reviewed-sha256','--compiler-sha256','--node-sha256'].every(key=>/^[a-f0-9]{64}$/.test(values[key])),'WALLET_BUILD_REVIEW_ARGUMENTS_INVALID');
  return{reviewPath:values['--review'],reviewedSha256:values['--reviewed-sha256'],compilerPath:values['--compiler'],compilerSha256:values['--compiler-sha256'],nodePath:values['--node'],nodeSha256:values['--node-sha256'],outputPath:values['--out']};
}
function privateReview(filename){const bytes=ordinary(filename,32*1024*1024),stat=fs.lstatSync(filename);need((stat.mode&0o077)===0&&(typeof process.getuid!=='function'||stat.uid===process.getuid()),'WALLET_BUILD_PRIVATE_REVIEW_REQUIRED');return JSON.parse(bytes);}
function privateDirectory(directory,checkout){need(path.isAbsolute(directory)&&fs.realpathSync(directory)===directory&&![checkout,packageRoot].some(root=>directory===root||directory.startsWith(root+path.sep)),'WALLET_BUILD_PRIVATE_OUTPUT_REQUIRED');const stat=fs.lstatSync(directory);need(stat.isDirectory()&&(stat.mode&0o077)===0&&(typeof process.getuid!=='function'||stat.uid===process.getuid()),'WALLET_BUILD_PRIVATE_OUTPUT_REQUIRED');}

// Offline preparation only. This portable core permits independent qualification;
// the operator CLI below is Mac-only. No campaign, session, actor lock or RPC call.
export function proposeWalletBuildPolicy({review,reviewedSha256,compiler,privateDirectory:directory}){
  validateWalletReview(review,reviewedSha256);privateDirectory(directory,review.native.checkout);
  observeSource(review.native,ALPHA_CURRENT);
  const checked=evaluateOffline(review.native,ALPHA_CURRENT,nativePlanCheck,[review.native.checkout,review.native.planPath]);
  need(checked.planSha256===review.planSha256&&checked.governor===review.governor&&checked.creationCount===5,'WALLET_BUILD_EXACT_NATIVE_PLAN_REQUIRED');
  const plan=readJson(review.native.planPath);
  const policy=prepareLocalReviewPolicy({campaign:{adapter:'alpha',coordinator:review.native},compiler,privateDirectory:directory,supported:ALPHA_CURRENT,nativePlanValidated:true});
  policy.campaignSha256=walletDeploymentBinding(review);
  const build=reproduceLocalBuild({policy,expectedPolicySha256:digest(policy),sourceRoot:review.native.checkout,observeSource:()=>observeSource(review.native,ALPHA_CURRENT)});
  need(build.receipt.planSha256===review.planSha256&&build.receipt.campaignSha256===walletDeploymentBinding(review)&&equal(build.receipt.source,review.source),'WALLET_BUILD_DEPLOYMENT_BINDING_MISMATCH');
  compareLocallyCompiledPlan(plan,build,review);build.assertUnchanged();
  need(equal(readJson(review.native.planPath),plan),'WALLET_BUILD_NATIVE_PLAN_CHANGED');
  return Object.freeze({policy,receipt:build.receipt,state:'UNAPPROVED_OWNER_REVIEW_REQUIRED',integritySha256:digest(policy),canonicalReceiptsVerified:false,creationCount:5,signingSupported:false,relaySupported:false,companionCampaignRequired:false});
}

export function prepareWalletBuildReview(options){
  assertTrustedSigningHost();
  const review=validateWalletReview(privateReview(options.reviewPath),options.reviewedSha256),compilerPath=fs.realpathSync(options.compilerPath),nodePath=fs.realpathSync(options.nodePath);
  need(compilerPath===options.compilerPath&&nodePath===options.nodePath&&digest(ordinary(compilerPath))===options.compilerSha256&&digest(ordinary(nodePath,256*1024*1024))===options.nodeSha256,'WALLET_BUILD_INDEPENDENT_COMPILER_RUNTIME_PINS_REQUIRED');
  const nodeVersion=execFileSync(nodePath,['--version'],{env:{LANG:'C',LC_ALL:'C'},encoding:'utf8',timeout:10000,maxBuffer:256}).trim().replace(/^v/,'');
  const compiler={kind:'soljson',path:compilerPath,sha256:options.compilerSha256,version:'0.8.37+commit.f401782d.Emscripten.clang',nodePath,nodeSha256:options.nodeSha256,nodeVersion};
  const result=proposeWalletBuildPolicy({review,reviewedSha256:options.reviewedSha256,compiler,privateDirectory:path.dirname(options.outputPath)});
  privateWrite(path.dirname(options.outputPath),result.policy,'.json',path.basename(options.outputPath));
  return{schema:'manual-ledger-wallet-build-review-proposal-v1',state:result.state,policyPath:options.outputPath,integritySha256:result.integritySha256,locallyRecompiled:true,creationCount:5,canonicalReceiptsVerified:false,companionCampaignRequired:false,nativeSigningSessionRequired:false,actorLocksRequired:false,signingSupported:false,relaySupported:false,activationAuthorized:false};
}
function main(){const options=parseWalletBuildReviewOptions(process.argv.slice(2));if(!options){process.stdout.write(WALLET_BUILD_REVIEW_USAGE+'\n');return;}process.stdout.write(JSON.stringify(prepareWalletBuildReview(options))+'\n');}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)try{main();}catch(error){const code=/^[A-Z][A-Z0-9_]{0,95}$/.test(error?.code||'')?error.code:'WALLET_BUILD_REVIEW_BLOCKED';process.stderr.write(code+': preserve the offline review inputs. Generated hashes are integrity values; independent owner review is required before verification or configuration.\n');process.exitCode=1;}
