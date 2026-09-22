'use strict';
const {qualificationFixture}=require('./qualification-fixture.cjs');
try{
 const args=process.argv.slice(2),role=args[0]||'agent';
 if(args.length>1||!['agent','reviewer'].includes(role))throw Error('Usage: economics:example -- [agent|reviewer]. Synthetic local-chain input only; no production authority.');
 const f=qualificationFixture({role,reviewPayment:'operator-budget'});
 process.stdout.write(JSON.stringify(Object.fromEntries(['policy','envelope','observed','portfolio','evidenceReport'].map(k=>[k,f[k]])),null,2)+'\n');
}catch(e){console.error(e.message);process.exitCode=1;}
