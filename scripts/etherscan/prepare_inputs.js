#!/usr/bin/env node
const fs = require('fs');

function fail(msg) { console.error(msg); process.exit(1); }
function parseArgs(argv) { const out = {}; for (let i=2;i<argv.length;i++){ const k=argv[i]; if(!k.startsWith('--')) continue; const n=k.slice(2); const v=argv[i+1]&&!argv[i+1].startsWith('--')?argv[++i]:'true'; out[n]=v;} return out; }
function parseAmount(raw, d){ const s=String(raw).trim(); if(!/^\d+(\.\d+)?$/.test(s)) fail(`Invalid amount: ${raw}`); const [w,f='']=s.split('.'); if(f.length>d) fail(`Too many decimal places for decimals=${d}`); return (BigInt(w)*(10n**BigInt(d))+BigInt((f+'0'.repeat(d)).slice(0,d))).toString(); }
function parseDuration(raw){ const s=String(raw).trim().toLowerCase(); if(/^\d+$/.test(s)) return s; const m=s.match(/^(\d+)([smhdw])$/); if(!m) fail(`Invalid duration: ${raw}`); const mult={s:1n,m:60n,h:3600n,d:86400n,w:604800n}[m[2]]; return (BigInt(m[1])*mult).toString(); }
function parseProof(raw){ if(!raw) return '[]'; const arr=JSON.parse(raw); if(!Array.isArray(arr)) fail('proof must be a JSON array'); return JSON.stringify(arr, null, 2); }
function checklist(action){ const common=['- Read paused(); intake actions require false.','- Read settlementPaused(); settlement actions require false.','- Confirm AGI balance and allowance on token contract.','- Read getJobCore(jobId) and getJobValidation(jobId) before writing.']; const extra={approve:['- Prefer exact-amount approval.'],createJob:['- Double-check payout base units and duration seconds.'],applyForJob:['- Choose one auth route: additional allowlist, Merkle proof, or ENS.'],requestJobCompletion:['- Caller must be assigned agent.'],validateJob:['- Review window must still be open.'],disapproveJob:['- Review window must still be open.'],resolveDisputeWithCode:['- Confirm dispute active and code is 0, 1, or 2.']}; return [...common,...(extra[action]||[])]; }

const args=parseArgs(process.argv); const action=args.action; if(!action) fail('Usage: node scripts/etherscan/prepare_inputs.js --action <...>');
const decimals=Number(args.decimals||'18'); if(!Number.isInteger(decimals)||decimals<0||decimals>36) fail('Invalid --decimals');
const out={action,checklist:checklist(action)};
if(action==='approve'){ if(!args.spender||!args.amount) fail('--spender --amount required'); out.writeFunction='approve(spender, amount)'; out.inputs={spender:args.spender,amount:parseAmount(args.amount,decimals)}; }
else if(action==='createJob'){ if(!args['job-spec-uri']||!args.payout||!args.duration||!args.details) fail('--job-spec-uri --payout --duration --details required'); out.writeFunction='createJob(jobSpecURI, payout, duration, details)'; out.inputs={jobSpecURI:args['job-spec-uri'],payout:parseAmount(args.payout,decimals),duration:parseDuration(args.duration),details:args.details}; }
else if(action==='applyForJob'){ if(!args['job-id']) fail('--job-id required'); out.writeFunction='applyForJob(jobId, subdomain, proof)'; out.inputs={jobId:args['job-id'],subdomain:args.subdomain||'',proof:parseProof(args.proof)}; }
else if(action==='requestJobCompletion'){ if(!args['job-id']||!args['completion-uri']) fail('--job-id --completion-uri required'); out.writeFunction='requestJobCompletion(jobId, jobCompletionURI)'; out.inputs={jobId:args['job-id'],jobCompletionURI:args['completion-uri']}; }
else if(action==='validateJob'||action==='disapproveJob'){ if(!args['job-id']) fail('--job-id required'); out.writeFunction=`${action}(jobId, subdomain, proof)`; out.inputs={jobId:args['job-id'],subdomain:args.subdomain||'',proof:parseProof(args.proof)}; }
else if(action==='resolveDisputeWithCode'){ if(!args['job-id']||args.code===undefined||args.reason===undefined) fail('--job-id --code --reason required'); out.writeFunction='resolveDisputeWithCode(jobId, resolutionCode, reason)'; out.inputs={jobId:args['job-id'],resolutionCode:Number(args.code),reason:args.reason}; }
else fail(`Unsupported action: ${action}`);

console.log('Copy/paste into Etherscan:\n');
console.log(`Write function: ${out.writeFunction}`);
console.log(JSON.stringify(out.inputs,null,2));
console.log('\nPre-flight checklist:'); out.checklist.forEach((i)=>console.log(i));
if(args.out) fs.writeFileSync(args.out, JSON.stringify(out,null,2));
