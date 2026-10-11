'use strict';
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),http=require('node:http');
const {randomUUID}=require('node:crypto'),{spawn}=require('node:child_process');
const I=require('./io.cjs'),T=require('./transport.cjs'),L=require('./runtime.cjs');
const C=require('../../../hardhat/scripts/check-ens-usdc-connection.cjs');
function complete(child,outcome,audit){return outcome.code===0&&!outcome.timedOut&&child?.status==='PASS'&&audit.rejections===0&&audit.upstreamFailures===0;}
function runChild({exe=process.execPath,args,cwd,env,timeoutMs=1200000}){
  return new Promise(resolve=>{
    let bytes=0,timedOut=false,hardKill;const child=spawn(exe,args,{cwd,env,stdio:['ignore','pipe','pipe']});
    // Do not publish arbitrary child output or provider exceptions. Fixed phase codes are in RESULT.json.
    for(const stream of [child.stdout,child.stderr])stream.on('data',chunk=>{bytes+=chunk.length;if(bytes>4*1024*1024)child.kill('SIGKILL');});
    const timer=setTimeout(()=>{timedOut=true;child.kill('SIGTERM');hardKill=setTimeout(()=>child.kill('SIGKILL'),3000);},timeoutMs);
    child.once('error',()=>{clearTimeout(timer);clearTimeout(hardKill);resolve({code:null,timedOut:false,error:'CHILD_START_FAILED'});});
    child.once('close',(code,signal)=>{clearTimeout(timer);clearTimeout(hardKill);resolve({code,signal,timedOut,outputBytes:bytes});});
  });
}
async function rehearse({root,input,url}){
  I.ensure(input,'REHEARSAL_OBSERVATION_REQUIRED');
  const reviewed=I.read(input,8*1024*1024),o=reviewed.value;
  require('./activation.cjs').validateObservation(o,Date.now());
  I.ensure(o.sections.ens.status==='PASS','REHEARSAL_CONNECTED_INSTANCE_REQUIRED');
  const identity=I.source(root);I.ensure(identity.commit===o.source.commit&&!identity.worktreeChanged,'REHEARSAL_SOURCE_CONFLICT');
  const installed=L.inspectInstalled(root),work=fs.mkdtempSync(path.join(os.tmpdir(),'agi-ens-rehearsal-'));fs.chmodSync(work,0o700);
  const transport=T.makeTransport(url,{limit:64*1024*1024,maxRequests:30000}),route='/readonly-'+randomUUID();let server;
  const report={schema:'agijobmanager-rehearsal-v1',status:'FAIL',launcher:'STOPPED',source:identity,snapshot:o.snapshot,simulationChainId:31337,
    reviewedObservationSha256:reviewed.sha256,child:null,childSha256:null,transport:transport.audit,
    intakeActivationAuthorized:false,productionReadinessCertified:false,publicTransactionsBroadcast:0,
    limitations:['Impersonation, local minting and allowlist fixtures do not establish real participant signing, eligibility or independence.','Fork results do not authorize intake. Original compiler/explorer evidence remains separate.']};
  try{
    I.ensure(C.quantity(await transport.rpc('eth_chainId',[]))===1n,'WRONG_CHAIN');
    const block=await transport.rpc('eth_getBlockByNumber',[o.snapshot.tag,false]);I.ensure(C.eq(block?.hash,o.snapshot.hash),'REHEARSAL_PIN_REORG');
    I.write(path.join(work,'package.json'),{private:true,type:'module'});
    I.write(path.join(work,'INPUT.json'),{snapshot:o.snapshot,root,source:identity});
    fs.mkdirSync(path.join(work,'unused-sources'),{mode:0o700});
    fs.copyFileSync(path.join(root,'scripts/commissioning/rehearsal.config.mjs'),path.join(work,'hardhat.config.mjs'));
    I.write(path.join(work,'LOCAL_RUNTIME.json'),L.linkInstalledDependencies(installed,work));
    server=http.createServer(async(req,res)=>{
      let request;try{
        I.ensure(req.method==='POST'&&req.url===route,'PROXY_ROUTE_REFUSED');
        const chunks=[];let n=0;for await(const c of req){n+=c.length;I.ensure(n<=1048576,'PROXY_BODY_LIMIT');chunks.push(c);}
        request=I.parse(Buffer.concat(chunks).toString('utf8'),1048576);
        const result=await transport.request(request);res.writeHead(200,{'content-type':'application/json'});res.end(JSON.stringify(result));
      }catch(e){transport.audit.rejections++;res.writeHead(200,{'content-type':'application/json'});
        const error=r=>({jsonrpc:'2.0',id:typeof r?.id==='number'||typeof r?.id==='string'?r.id:null,error:{code:-32000,message:'Read-only transport stopped'}});
        res.end(JSON.stringify(Array.isArray(request)?request.map(error):error(request)));}
    });
    server.requestTimeout=30000;server.headersTimeout=10000;
    await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
    const env={PATH:process.env.PATH,HOME:os.homedir(),LANG:'C.UTF-8',CI:'true',DO_NOT_TRACK:'1',HARDHAT_DISABLE_TELEMETRY:'1',PRIVATE_KEY:'',DEPLOY_CONFIRM_MAINNET:'',
      ENS_REHEARSAL_WORK:work,ENS_REHEARSAL_REPO:root,ENS_REHEARSAL_PROXY:`http://127.0.0.1:${server.address().port}${route}`,
      XDG_CACHE_HOME:path.join(work,'user-cache'),XDG_CONFIG_HOME:path.join(work,'user-config'),XDG_DATA_HOME:path.join(work,'user-data')};
    L.assertSameRuntime(installed,work);
    report.outcome=await runChild({args:[installed.cli,'--config',path.join(work,'hardhat.config.mjs'),'run','--no-compile',path.join(root,'scripts/commissioning/rehearsal.mjs'),'--network','ensRehearsal'],cwd:work,env});
    I.ensure(fs.existsSync(path.join(work,'RESULT.json')),'REHEARSAL_CHILD_RESULT_MISSING');
    const child=I.read(path.join(work,'RESULT.json'),4*1024*1024);report.child=child.value;report.childSha256=child.sha256;
    const after=await transport.rpc('eth_getBlockByNumber',[o.snapshot.tag,false]);I.ensure(C.eq(after?.hash,o.snapshot.hash),'REHEARSAL_PIN_REORG');
    I.ensure(C.quantity(await transport.rpc('eth_chainId',[]))===1n,'CHAIN_CHANGED');
    I.ensure(complete(report.child,report.outcome,transport.audit),'REHEARSAL_CHILD_OR_TRANSPORT_STOPPED');
    I.ensure(I.sameSource(identity,I.source(root)),'REHEARSAL_SOURCE_CHANGED_DURING_RUN');
    report.status='PASS';report.launcher='COMPLETED';
  }catch(e){report.code=I.failure(e);}
  finally{if(server){server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}I.write(path.join(work,'REVIEW.json'),report);}
  return report;
}
module.exports={rehearse,runChild,complete};
