'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {spawnSync}=require('node:child_process');
const I=require('../../scripts/commissioning/lib/io.cjs'),T=require('../../scripts/commissioning/lib/transport.cjs');
const A=require('../../scripts/commissioning/lib/activation.cjs'),S=require('../../scripts/commissioning/lib/isolation.cjs');
const {accounting,RESERVES}=require('../../scripts/commissioning/lib/inspect.cjs');
const {complete,runChild}=require('../../scripts/commissioning/lib/rehearsal.cjs');
const root=path.resolve(__dirname,'../..'),shell=path.join(root,'scripts/commissioning/command.sh');
const env={PATH:process.env.PATH,HOME:os.homedir()};
const hash='0x'+'ab'.repeat(32),address='0x'+'12'.repeat(20),zero='0x'+'00'.repeat(20),at={blockHash:hash,requireCanonical:true};
const call=(method,params,id=1)=>({jsonrpc:'2.0',id,method,params});
for(const [method,params] of [
  ['eth_chainId',[]],['eth_getCode',[address,at]],['eth_getStorageAt',[address,'0x0',at]],['eth_getBlockByNumber',['latest',false]],
  ['eth_getBlockByNumber',['0x123',true]],['eth_getBlockByHash',[hash,true]],
  ['eth_call',[{to:address,data:'0x12345678',from:zero},at]],['eth_getLogs',[{address,fromBlock:'0x0',toBlock:'0x1387',topics:[hash]}]],
  ['eth_feeHistory',['0x10','latest',[0,50,100]]]
])test('strict read transport admits '+method,()=>assert.doesNotThrow(()=>T.requestAllowed(call(method,params))));
for(const method of ['eth_sendTransaction','eth_sendRawTransaction','eth_sign','personal_sign','hardhat_impersonateAccount','evm_mine','anvil_setBalance','unknown'])test('transport refuses '+method,()=>assert.throws(()=>T.requestAllowed(call(method,[]))));
for(const [method,params] of [
 ['eth_chainId',['extra']],['eth_getBlockByNumber',['0x123','true']],['eth_getCode',[address]],['eth_getCode',[address,{blockHash:hash,requireCanonical:false}]],
 ['eth_call',[{to:address,data:'0x',from:address},at]],['eth_call',[{to:address,data:'0x',value:'0x1'},at]],['eth_call',[{to:address,data:'0x'},'latest']],
 ['eth_getLogs',[{address,fromBlock:'0x0',toBlock:'0x1388',topics:[hash]}]],['eth_getLogs',[{address,fromBlock:'latest',toBlock:'latest',topics:[hash]}]],
 ['eth_feeHistory',['0x0','latest',[]]],['eth_feeHistory',['0x401','latest',[]]],['eth_feeHistory',['0x1','latest',[60,40]]],['eth_feeHistory',['0x1','latest',[NaN]]]
])test('invalid parameters stop '+method+' '+JSON.stringify(params),()=>assert.throws(()=>T.requestAllowed(call(method,params))));
test('batch validation rejects duplicate IDs, notifications, empty and excessive batch',()=>{
 for(const value of [[],Array(101).fill(call('eth_chainId',[])),[call('eth_chainId',[]),call('eth_chainId',[])],{jsonrpc:'2.0',method:'eth_chainId',params:[]}])assert.throws(()=>T.requestAllowed(value));
});
for(const response of [{jsonrpc:'2.0',id:2,result:'0x1'},{jsonrpc:'2.0',id:1,result:'0x1',error:{}},[{jsonrpc:'2.0',id:1,result:'0x1'}],{jsonrpc:'1.0',id:1,result:'0x1'}])test('response identity cannot be substituted '+JSON.stringify(response),()=>assert.throws(()=>T.validateResponse(call('eth_chainId',[]),response)));
test('bounded stream stops before consuming oversized body and rejects duplicate decoded keys',async()=>{
 let consumed=0;const response={headers:{get:()=>null},body:(async function*(){for(let i=0;i<100;i++){consumed++;yield Buffer.alloc(32);}})()};
 await assert.rejects(T.boundedBody(response,64));assert.equal(consumed,3);
 const d={headers:{get:()=>null},body:(async function*(){yield Buffer.from('{"id":1,"\\u0069d":2}');})()};await assert.rejects(T.boundedBody(d));
});
test('upstream failures are fixed codes; endpoints and arbitrary throws are not returned',async()=>{
 const t=T.makeTransport('https://example.invalid/SECRET',{fetchImpl:async()=>{throw 'SECRET';}});
 await assert.rejects(t.rpc('eth_chainId',[]),{message:'RPC_TRANSPORT_FAILURE'});assert.equal(t.audit.upstreamFailures,1);
});
for(const url of ['http://example.invalid','https://user:secret@example.invalid','not-a-url','https://example.invalid/#secret'])test('unsafe endpoint refused '+url.split(':')[0],()=>assert.throws(()=>T.makeTransport(url)));
test('all five reserves including claims govern solvency and positive surplus is allowed',()=>{
 const reserves=Object.fromEntries(RESERVES.map(k=>[k,0n]));assert.equal(accounting(3940000n,reserves).status,'PASS');
 reserves.lockedClaims=1n;assert.equal(accounting(0n,reserves).solvent,false);assert.equal(accounting(2n,reserves).initialActivationReservesZero,false);
 for(const k of RESERVES){const r=Object.fromEntries(RESERVES.map(n=>[n,n===k?100n:0n]));assert.equal(accounting(99n,r).solvent,false);}
 assert.throws(()=>accounting(1.2,reserves));
});
test('blank activation template produces exactly five finite unresolved groups and no approval',()=>{
 const r=A.review(A.template());assert.deepEqual(r.groups.map(g=>g.id),['A1','A2','A3','A4','A5']);assert(r.groups.every(g=>g.status==='NEEDS_OPERATOR_INPUT'));assert.equal(r.intakeActivationAuthorized,false);
});
test('untrusted input cannot grant activation authority',()=>{const x=A.template();x.intakeActivationAuthorized=true;assert.throws(()=>A.review(x));});
test('stopped launcher, errors, timeout and transport failures override child PASS',()=>{
 const outcome={code:0,timedOut:false},audit={rejections:0,upstreamFailures:0};assert.equal(complete({status:'PASS'},outcome,audit),true);
 for(const change of [{code:1},{timedOut:true}])assert.equal(complete({status:'PASS'},{...outcome,...change},audit),false);
 for(const change of [{rejections:1},{upstreamFailures:1}])assert.equal(complete({status:'PASS'},outcome,{...audit,...change}),false);
 assert.equal(complete(null,outcome,audit),false);
});
test('real child timeout is stopped and raw child output is not returned',async()=>{
 const r=await runChild({args:['-e','console.error("SECRET");setInterval(()=>{},1000)'],cwd:root,env,timeoutMs:50});assert.equal(r.timedOut,true);assert(!JSON.stringify(r).includes('SECRET'));
});
test('source changes during observation or rehearsal cannot acquire the original identity',()=>{
 const source={commit:'a'.repeat(40),tree:'b'.repeat(40),worktreeChanged:false};
 assert.equal(I.sameSource(source,{...source}),true);
 for(const change of [{commit:'c'.repeat(40)},{tree:'d'.repeat(40)},{worktreeChanged:true}])assert.equal(I.sameSource(source,{...source,...change}),false);
});
test('custody comparison handles native bigint fuses and expiry without masking drift',()=>{
 S.compare(['holder',0n,1791725015n],['holder',0n,1791725015n],'CUSTODY_CHANGED');
 assert.throws(()=>S.compare(['holder',0n,1791725015n],['holder',1n,1791725015n],'CUSTODY_CHANGED'),{code:'CUSTODY_CHANGED'});
});
test('resolved Hardhat URL uses original receiver and awaits getUrl',async()=>{
 const value={_type:'ResolvedConfigurationVariable',secret:'http://127.0.0.1:1234/readonly-test',async getUrl(){assert.equal(this,value);return this.secret;}};
 assert.equal((await S.resolveForkUrl(value)).url,value.secret);
 for(const x of [{value:value.secret},{toString:()=>value.secret},{getUrl:()=>value.secret},null,[]])await assert.rejects(S.resolveForkUrl(x));
});
test('exact local proxy and network identity are required before fork execution',async()=>{
 const proxy='http://127.0.0.1:1234/readonly-test',pin={block:{number:123}},config={type:'edr-simulated',chainId:31337,allowUnlimitedContractSize:false,forking:{url:proxy,blockNumber:123}};
 await S.assertLocal({networkName:'ensRehearsal',networkConfig:config},31337,pin,proxy);
 for(const change of [{type:'http'},{chainId:1},{allowUnlimitedContractSize:true},{forking:{url:'https://mainnet.invalid',blockNumber:123}}])await assert.rejects(S.assertLocal({networkName:'ensRehearsal',networkConfig:{...config,...change}},31337,pin,proxy));
});
test('real shell rejects Node preload before it can execute',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'commission-cli-')),marker=path.join(dir,'marker'),preload=path.join(dir,'preload.cjs');
 fs.writeFileSync(preload,`require('fs').writeFileSync(${JSON.stringify(marker)},'unsafe')`);
 const r=spawnSync('bash',[shell,'evidence'],{env:{...env,NODE_OPTIONS:'--require '+preload},encoding:'utf8'});
 assert.equal(r.status,2);assert(!fs.existsSync(marker));fs.rmSync(dir,{recursive:true});
});
for(const cwd of [root,path.join(root,'hardhat')])test('real CLI documented invocation context '+path.basename(cwd),()=>{
 for(const [args,status] of [[['evidence'],0],[['activation','--template'],0],[['inspect','--help'],0],[['inspect','--instance','recorded-2026-10-10','--out','/unused/report.json'],2],[['ens','--deploy'],2],[['unknown'],2]]){
  const r=spawnSync('bash',[shell,...args],{cwd,env,encoding:'utf8'});assert.equal(r.status,status,r.stderr);assert(!r.stderr.includes(' at '));
 }
});
test('exclusive private files, traversal, duplicate keys and unsupported shapes',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'commission-io-'));fs.chmodSync(dir,0o700);const file=path.join(dir,'x.json');
 I.write(file,{value:1});assert.equal(fs.statSync(file).mode&0o777,0o600);assert.throws(()=>I.write(file,{value:2}));
 fs.symlinkSync(file,path.join(dir,'link'));assert.throws(()=>I.read(path.join(dir,'link')));assert.throws(()=>I.read(dir+'/../x.json'));
 assert.throws(()=>I.parse('{"a":1,"\\u0061":2}'));assert.throws(()=>I.parse('['.repeat(49)+']'.repeat(49)));assert.throws(()=>I.read(file,1));fs.rmSync(dir,{recursive:true});
});
for(const [name,contents] of [['missing',null],['syntax','SECRET malformed !'],['primitive',"throw 'SECRET';"],['unexpected exports','module.exports = 17;']])test('actual CLI sanitizes '+name+' module failure',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'agi-cli-broken-'));fs.mkdirSync(path.join(dir,'lib'));
 fs.copyFileSync(path.join(root,'scripts/commissioning/cli.cjs'),path.join(dir,'cli.cjs'));
 fs.copyFileSync(path.join(root,'scripts/commissioning/lib/io.cjs'),path.join(dir,'lib/io.cjs'));
 if(contents!==null)fs.writeFileSync(path.join(dir,'mainnet-evidence.cjs'),contents);
 const r=spawnSync(process.execPath,[path.join(dir,'cli.cjs'),'evidence'],{env,encoding:'utf8'});
 assert.equal(r.status,2);assert.equal(r.stderr.trim(),'STOP: LOCAL_MODULE_INPUT_OR_IO_FAILURE');assert(!r.stdout.includes('SECRET'));fs.rmSync(dir,{recursive:true});
});
