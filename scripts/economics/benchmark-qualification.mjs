import fs from 'node:fs';
import os from 'node:os';
import {performance} from 'node:perf_hooks';
import {QualificationService} from './qualification-service.mjs';
import fixture from './qualification-fixture.cjs';
import core from './admission.cjs';
const count=Number(process.argv[2]??200),out=process.argv[3];
if(!Number.isSafeInteger(count)||count<50||count>5000)throw Error('Usage: node scripts/economics/benchmark-qualification.mjs COUNT [OUTPUT_JSON]; count 50..5000');
const packet=fixture.qualificationFixture(),runs=[];
for(const mode of ['paced','burst']){
 const service=new QualificationService({maxConcurrent:4,maxQueued:32}),start=performance.now(),results=[];
 const check=async()=>{await new Promise(resolve=>setImmediate(resolve));return core.checkAdmission({...packet,now:Math.floor(Date.now()/1000)});};
 if(mode==='paced'){for(let i=0;i<count;i+=3)results.push(...await Promise.allSettled(Array.from({length:Math.min(3,count-i)},(_,j)=>service.run(String(i+j),check))));}
 else results.push(...await Promise.allSettled(Array.from({length:count},(_,i)=>service.run(String(i),check))));
 await new Promise(resolve=>setImmediate(resolve));
 const elapsedMs=performance.now()-start,accepted=results.filter(x=>x.status==='fulfilled').length;
 runs.push({mode,submitted:count,accepted,rejected:count-accepted,elapsedMs,acceptedPerSecond:accepted*1000/elapsedMs,rejectionReasons:results.filter(x=>x.status==='rejected').reduce((a,x)=>(a[x.reason.message]=(a[x.reason.message]??0)+1,a),{}),metrics:service.snapshot()});service.close();
}
const result={schemaVersion:1,generatedAt:new Date().toISOString(),runtime:process.version,platform:process.platform,architecture:process.arch,cpu:os.cpus()[0]?.model,runs,scope:'Local full signed-envelope/calibrated-report verification. Synthetic fixture; no network RPC, production signing issuer, provider costs, Macs, distributed reservations or million-offer workload. Event-loop concurrency is not CPU parallelism. Burst rejection is backpressure, not completed work.'};
if(out)fs.writeFileSync(out,JSON.stringify(result,null,2)+'\n',{flag:'wx'});else console.log(JSON.stringify(result,null,2));
