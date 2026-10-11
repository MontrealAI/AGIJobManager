'use strict';
// Filesystem/launcher fixtures only. This is not the Hardhat runtime or an EVM.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),crypto=require('node:crypto');
const write=(name,text)=>{fs.mkdirSync(path.dirname(name),{recursive:true});fs.writeFileSync(name,text);};
function fixture(scenario='success', layout='root') {
  const base=fs.mkdtempSync(path.join(os.tmpdir(),'ens-launch-fixture-'));
  const repo=path.join(base,'repo with spaces'),work=path.join(base,'workspace'),home=path.join(base,'home');
  fs.mkdirSync(work);fs.mkdirSync(home);
  write(path.join(repo,'package.json'),JSON.stringify({name:'synthetic-rehearsal-fixture',type:'module',private:true}));
  write(path.join(repo,'.fixture-scenario'),scenario);
  write(path.join(repo,'contracts/ens/ENSJobPages.sol'),'// SYNTHETIC TEST SOURCE, NOT A DEPLOYABLE CONTRACT\n');
  const hardhat=path.join(repo,'node_modules/hardhat');
  write(path.join(hardhat,'package.json'),JSON.stringify({name:'hardhat',version:'3.17.0-fixture',type:'module',exports:{'.':'./dist/src/index.js'},bin:{hardhat:'dist/src/cli.js'}}));
  write(path.join(hardhat,'dist/src/index.js'),'const hre = {}; export default hre;\n');
  write(path.join(hardhat,'dist/src/cli.js'),String.raw`
import fs from 'node:fs';import path from 'node:path';import {createRequire} from 'node:module';import {pathToFileURL,fileURLToPath} from 'node:url';
const args=process.argv.slice(2),config=args[args.indexOf('--config')+1],script=args[args.indexOf('--no-compile')+1];
const repo=process.env.ENS_REHEARSAL_REPO,work=process.env.ENS_REHEARSAL_WORK;
const origin=createRequire(config+'/');
let resolved;for(const lookup of origin.resolve.paths('hardhat')||[]){const p=path.join(lookup,'hardhat/package.json');if(fs.existsSync(p)){resolved=fs.realpathSync(p);break;}}
const executing=fs.realpathSync(path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../package.json'));
if(resolved!==executing){console.error('HHE22 synthetic reproduction: config cannot resolve the invoking local installation');process.exit(1);}
if(!args.includes('--no-compile') || process.env.PRIVATE_KEY!=='' || process.env.DEPLOY_CONFIRM_MAINNET!=='' || process.env.MAINNET_RPC_URL!==undefined || process.env.NODE_OPTIONS!==undefined)throw Error('FIXTURE: unsafe child launch');
const scenario=fs.readFileSync(path.join(repo,'.fixture-scenario'),'utf8');
fs.appendFileSync(path.join(work,'FIXTURE_CHILDREN.log'),path.basename(script)+'\n');
if(path.basename(script)==='startup-check.mjs' && scenario==='startup-fail'){console.error('SYNTHETIC_STARTUP_FAILURE https://example.invalid/credential');process.exit(2);}
const {default:cfg}=await import(pathToFileURL(config).href);
const fork=cfg.networks.ensRehearsal.forking;
const rawForkUrl=fork.url;
fork.url={_type:'ResolvedConfigurationVariable', async getUrl() {
  await new Promise(resolve=>setTimeout(resolve,5));
  if(scenario==='resolved-url-fail')throw Error('DO_NOT_LEAK_UPSTREAM_URL_OR_SECRET');
  if(scenario==='resolved-url-wrong-proxy')return rawForkUrl+'-wrong-route';
  return rawForkUrl;
}, toString(){throw Error('MUST_NOT_COERCE_RESOLVED_URL');}};
const {default:activeHre}=await import('./index.js');
Object.assign(activeHre,{config:cfg,network:{create(){throw Error('SYNTHETIC FIXTURE HAS NO EVM');}},artifacts:{readArtifact(){throw Error('SYNTHETIC FIXTURE HAS NO BUILD');}}});
if(cfg.plugins.some(p=>p.fixturePeer !== activeHre))throw Error('MIXED_HARDHAT_SINGLETONS');
if(path.basename(script)==='startup-check.mjs') {
  await import(pathToFileURL(script).href);
  if(scenario==='drift') {fs.rmSync(path.join(work,'node_modules'),{recursive:true});fs.mkdirSync(path.join(work,'node_modules/hardhat'),{recursive:true});fs.writeFileSync(path.join(work,'node_modules/hardhat/package.json'),'{}');}
} else {
  const {default:L}=await import(pathToFileURL(path.join(process.env.ENS_REHEARSAL_PACKET,'lib/local-project.cjs')).href);
  const {local}=L.requireWorkspaceRuntime(repo,work);
  const {default:runnerHre}=await import(pathToFileURL(local.resolve('hardhat')).href);
  if(runnerHre!==activeHre)throw Error('FORK_RUNNER_USES_DIFFERENT_HARDHAT');
  if(local('solc').fixture!==true)throw Error('ROOT_COMPILER_NOT_RESOLVED');
  if(scenario==='blocked-write')await fetch(process.env.ENS_REHEARSAL_PROXY,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:90,method:'eth_sendRawTransaction',params:['0x00']})});
  const rejectedPayloads={
    'fee-history-read': {jsonrpc:'2.0',id:90,method:'eth_feeHistory',params:['0x1','latest',[50]]},
    'fee-history-empty-percentiles': {jsonrpc:'2.0',id:90,method:'eth_feeHistory',params:['0x5','0x18f38da',[]]},
    'fee-history-malformed': {jsonrpc:'2.0',id:90,method:'eth_feeHistory',params:['0x401','latest',[50]]},
    'fee-history-mixed-batch': [{jsonrpc:'2.0',id:90,method:'eth_feeHistory',params:['0x1','latest',[50]]},{jsonrpc:'2.0',id:91,method:'eth_sendRawTransaction',params:['DO_NOT_RECORD_SIGNED_PAYLOAD']}],
    'fee-history-allowed-batch': [{jsonrpc:'2.0',id:90,method:'eth_feeHistory',params:['0x1','latest',[50]]},{jsonrpc:'2.0',id:91,method:'eth_getBalance',params:['0x00','latest']}],
    'unlisted-read': {jsonrpc:'2.0',id:90,method:'web3_clientVersion',params:[]},
    'omitted-params': {jsonrpc:'2.0',id:90,method:'eth_chainId'},
    'mixed-batch': [{jsonrpc:'2.0',id:90,method:'eth_getBalance',params:['0x00','latest']},{jsonrpc:'2.0',id:91,method:'eth_sendRawTransaction',params:['DO_NOT_RECORD_SIGNED_PAYLOAD']}],
    'object-params': {jsonrpc:'2.0',id:90,method:'eth_chainId',params:{secret:'DO_NOT_RECORD_PARAMS'}},
    'allowed-read': {jsonrpc:'2.0',id:90,method:'eth_getBalance',params:['0x00','latest']},
  };
  if(Object.hasOwn(rejectedPayloads,scenario)) {
    const response=await fetch(process.env.ENS_REHEARSAL_PROXY,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(rejectedPayloads[scenario])});
    const reply=await response.json();
    fs.writeFileSync(path.join(work,'FIXTURE_RPC_REPLY.json'),JSON.stringify(reply));
  }
  if(scenario==='invalid-json')await fetch(process.env.ENS_REHEARSAL_PROXY,{method:'POST',headers:{'Content-Type':'application/json'},body:'DO_NOT_RECORD_INVALID_JSON'});
  if(scenario==='wrong-route')await fetch(process.env.ENS_REHEARSAL_PROXY+'-WRONG_PRIVATE_ROUTE',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});
  if(scenario!=='missing-result')fs.writeFileSync(path.join(work,'RESULT.json'),JSON.stringify({schema:'SYNTHETIC-LAUNCHER-FIXTURE-ONLY',status:scenario==='fork-fail'?'STOPPED':'FORK_REHEARSAL_PASSED_REVIEW_REQUIRED',fixtureOnly:true,checks:['synthetic checkpoint'],publicTransactionsBroadcast:0,readyToDeploy:scenario==='promoted-result',readyToApprove:false,intakeActivationAuthorized:false}));
  if(scenario==='fork-fail'){console.error('SYNTHETIC_FORK_STAGE_FAILURE');process.exitCode=1;}
}
`);
  const plugin=path.join(repo,'node_modules/@nomicfoundation/hardhat-ethers');
  write(path.join(plugin,'package.json'),JSON.stringify({name:'@nomicfoundation/hardhat-ethers',version:'4.0.0-fixture',type:'module',exports:{'.':'./index.js'}}));
  write(path.join(plugin,'index.js'),"import hre from 'hardhat'; export default {id:'synthetic-ethers-plugin',fixturePeer:hre};\n");
  for(const [name,version] of [['ethers','6.17.0-fixture'],['dotenv','16.6.1-fixture'],['solc','0.8.37-fixture']]) {
    write(path.join(repo,'node_modules',name,'package.json'),JSON.stringify({name,version,main:'index.cjs'}));
    write(path.join(repo,'node_modules',name,'index.cjs'), name==='dotenv' ? 'exports.parse = () => ({});\n' : 'exports.fixture = true;\n');
  }
  if(layout!=='root') {
    const sub=path.join(repo,'hardhat');
    write(path.join(sub,'package.json'),JSON.stringify({name:'synthetic-hardhat-subproject',type:'module',private:true}));
    fs.mkdirSync(path.join(sub,'node_modules'),{recursive:true});
    for(const name of ['@nomicfoundation/hardhat-ethers','ethers','dotenv',...(layout==='split'?['hardhat']:[])]) {
      const dst=path.join(sub,'node_modules',name);fs.mkdirSync(path.dirname(dst),{recursive:true});
      fs.cpSync(path.join(repo,'node_modules',name),dst,{recursive:true});
    }
    fs.rmSync(plugin,{recursive:true});
  }
  write(path.join(work,'package.json'),'{"type":"module","private":true}\n');
  write(path.join(work,'hardhat.config.mjs'),'export default {};\n');
  return {base,repo,work,home,hardhat,cleanup(){fs.rmSync(base,{recursive:true,force:true});}};
}
function snapshot(dir) {
  const found={};
  function visit(d) {for(const entry of fs.readdirSync(d,{withFileTypes:true})) {const p=path.join(d,entry.name),rel=path.relative(dir,p);if(entry.isDirectory())visit(p);else if(entry.isSymbolicLink())found[rel]='link:'+fs.readlinkSync(p);else found[rel]=crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');}}
  visit(dir);return found;
}
module.exports={fixture,write,snapshot};
