#!/usr/bin/env node
'use strict';
// User-run CLI. plan is offline; read-only methods never import the relay module.
const path=require('node:path'),fs=require('node:fs'),crypto=require('node:crypto');
const T=require('./transaction-envelope.cjs'),P=require('./core-creation-plan.cjs'),S=require('./deployment-session.cjs'),V=require('./core-creation-verifier.cjs');
const {loadQualifiedBuild}=require('./qualified-build-catalog.cjs');
const X=require('./operator-paths.cjs');
const {durableWrite}=require('./creator-transaction.cjs');
function flags(args){const out={};T.need(args.length%2===0,'Arguments must be --name value pairs.');for(let i=0;i<args.length;i+=2){T.need(/^--[a-z-]+$/.test(args[i])&&!Object.hasOwn(out,args[i].slice(2)),'Invalid/duplicate argument.');out[args[i].slice(2)]=args[i+1];}return out;}
const outputReservations=new Map();
function outputIdentity(file,directory=false){const stat=fs.lstatSync(file,{bigint:true});T.need(!stat.isSymbolicLink()&&(directory?stat.isDirectory():stat.isFile())&&fs.realpathSync(file)===path.resolve(file),'Output reservation must retain real file/directory paths.');return {dev:String(stat.dev),ino:String(stat.ino),mode:String(stat.mode),...(directory?{}:{size:String(stat.size)})};}
function pinOutput(output){const parents=[];for(let p=path.dirname(output);;p=path.dirname(p)){parents.push({path:p,identity:outputIdentity(p,true)});if(path.dirname(p)===p)break;}return {parents,file:outputIdentity(output),sha256:crypto.createHash('sha256').update(fs.readFileSync(output)).digest('hex')};}
function writeReservedOutput(output,result){const saved=outputReservations.get(output);T.need(saved,'Original output reservation is required.');for(const parent of saved.parents)T.need(T.canonical(outputIdentity(parent.path,true))===T.canonical(parent.identity),'Output parent identity changed; preserve both locations.');T.need(T.canonical(outputIdentity(output))===T.canonical(saved.file)&&crypto.createHash('sha256').update(fs.readFileSync(output)).digest('hex')===saved.sha256,'Output reservation identity or bytes changed; preserve all entries.');durableWrite(output,result);outputReservations.delete(output);}
function reserveOutput(out,command){const output=X.requireExternalPath(out,{label:'Output'});const fs=require('node:fs');T.need(fs.realpathSync(path.dirname(output))===path.dirname(output),'Output parent must be a real existing directory.');durableWrite(output,{schema:'manager-command-output-reserved-v1',command,status:'RESERVED_BEFORE_ACTION',notice:'If interrupted, recover from the durable session. This reservation is not a successful operation report.'},{exclusive:true});outputReservations.set(output,pinOutput(output));return output;}
function validateOperatorPaths(opt){X.requireExternalPath(opt.out,{label:'Output'});if(opt.session){X.requireSessionPaths(opt.session);if(require('node:fs').existsSync(opt.session)){const meta=S.readJson(path.join(opt.session,'session.json'));X.requireSessionPaths(opt.session,meta);}}if(opt['lock-directory'])X.requireExternalPath(opt['lock-directory'],{label:'Shared lock directory'});if(opt['signed-file'])X.requireExternalPath(opt['signed-file'],{label:'Signed transaction input'});}
async function main(argv=process.argv.slice(2)){
 const [command,...rest]=argv,opt=flags(rest),common=['catalog','catalog-sha','build-id','out'];
 const allowed={plan:[...common,'config'],preflight:[...common,'plan'],start:[...common,'plan','session','lock-directory'],handoff:[...common,'session'],import:[...common,'session','signed-file'],recover:[...common,'session'],reconcile:[...common,'session'],complete:[...common,'session'],relay:[...common,'session','acknowledgement'],'retrieve-handoff':[...common,'session'],'inspect-journal':[...common,'session'],'repair-journal':[...common,'session','acknowledgement']};
 T.need(allowed[command]&&Object.keys(opt).every(k=>allowed[command].includes(k))&&allowed[command].every(k=>typeof opt[k]==='string'&&opt[k]),'Exact command options required; no trust-source or signer bypass is supported.');
 validateOperatorPaths(opt);
 const sourceGuard=P.createSourceGuard(),source=sourceGuard.source,qualified=loadQualifiedBuild(opt.catalog,{expectedCatalogSha256:opt['catalog-sha'],buildId:opt['build-id'],expectedRevision:source});
 const output=reserveOutput(opt.out,command);
 let result;
 if(command==='plan')result=P.makePlan(S.readJson(opt.config),qualified,source);
 else{
  const plan=opt.plan?S.readJson(opt.plan):S.readSession(opt.session,{allowHeadLag:['inspect-journal','repair-journal'].includes(command)}).plan;P.checkPlan(plan,qualified,source);
  const context={directory:opt.session,qualified,source,revalidateSource:sourceGuard.assertUnchanged};
  if(!['import','retrieve-handoff','inspect-journal','repair-journal'].includes(command)){
   const {createReadRpc,scopeFor}=require('./deployment-rpc.cjs');context.rpc=createReadRpc(process.env.MANAGER_READ_RPC_URL,{scope:scopeFor(plan)});
  }
  if(command==='retrieve-handoff')result=S.retrieveHandoff(context);
  else if(command==='inspect-journal')result=S.inspectJournal(context);
  else if(command==='repair-journal')result=await S.repairJournal(context,opt.acknowledgement);
  else if(command==='preflight')result=await V.preflight(plan,qualified,source,context.rpc);
  else if(command==='start')result=await S.initialize({...context,plan,lockDirectory:opt['lock-directory']});
  else if(command==='handoff')result=await S.handoff(context);
  else if(command==='import'){const signed=S.readJson(opt['signed-file']);T.exact(signed,['raw']);result=await S.importSigned(context,signed.raw);}
  else if(command==='recover')result=await S.recover(context);
  else if(command==='reconcile')result=await S.reconcile(context);
  else if(command==='complete')result=await S.complete(context);
  else if(command==='relay')result=await require('./raw-transaction-relay.cjs').relayOperation(context,{endpoint:process.env.MANAGER_RELAY_RPC_URL,acknowledgement:opt.acknowledgement});
 }
 sourceGuard.assertUnchanged();qualified.assertUnchanged();
 writeReservedOutput(output,result);console.log(`Wrote new ${command} report. No activation/configuration operation is included.`);
}
module.exports={flags,reserveOutput,validateOperatorPaths,main};if(require.main===module)main().catch(()=>{console.error('MANAGER_CORE_COMMAND_FAILED: Stop and preserve private inputs and the session. Inspect or recover before any retry; no activation was authorized.');process.exitCode=1;});
