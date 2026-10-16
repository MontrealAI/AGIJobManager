import { spawn } from 'node:child_process';
import { readdir, mkdir, writeFile } from 'node:fs/promises';
const files=(await readdir('test')).filter(name=>name.endsWith('.test.mjs')).sort().map(name=>`test/${name}`);
const child=spawn(process.execPath,['--test','--test-reporter=tap',...files],{stdio:['ignore','pipe','pipe'],env:process.env});
let output='',bytes=0,overflow=false;
for(const stream of [child.stdout,child.stderr])stream.on('data',part=>{bytes+=part.length;if(bytes<=4*1024*1024)output+=part;else{overflow=true;child.kill('SIGTERM');}});
const code=await new Promise(resolve=>{child.once('error',()=>resolve(1));child.once('exit',code=>resolve(code??1));});
const total=key=>Number(output.match(new RegExp(`^# ${key} (\\d+)$`,'m'))?.[1]??0);
const failureCases=[...new Set([...output.matchAll(/^[ \t]*not ok \d+ - ([^\r\n]{1,512})$/gm)].map(match=>match[1].replace(/0x[0-9a-f]{32,}|[0-9a-f]{64,}/gi,'[REDACTED_HEX]').replace(/[\x00-\x1f\x7f]/g,'').slice(0,240)))].slice(0,24);
const result={schema:'ledger-companion-browser-regression-evidence-v1',status:code===0&&!overflow?'PASS':'FAIL',sourceCommit:/^[a-f0-9]{40}$/.test(process.env.COMPANION_SOURCE_COMMIT??'')?process.env.COMPANION_SOURCE_COMMIT:null,workflowRunId:/^[0-9]+$/.test(process.env.GITHUB_RUN_ID??'')?process.env.GITHUB_RUN_ID:null,tests:total('tests'),pass:total('pass'),fail:total('fail'),cancelled:total('cancelled'),skipped:total('skipped'),todo:total('todo'),failureCases,outputRedacted:true,syntheticCapabilitiesNotPublished:true};
await mkdir('manual-ledger-evidence',{recursive:true});await writeFile('manual-ledger-evidence/browser-deterministic-regressions.json',`${JSON.stringify(result,null,2)}\n`);
process.stdout.write(`Deterministic regressions ${result.status}: ${result.pass}/${result.tests} passed; ${result.skipped} skipped; ${result.cancelled} cancelled; ${result.todo} todo; output redacted.\n`);
if(result.status!=='PASS'){for(const name of failureCases)process.stdout.write(`Failed case: ${name}\n`);process.exitCode=1;}
