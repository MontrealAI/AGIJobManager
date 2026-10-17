'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {OPTIMIZER_STEPS}=require('../../hardhat/compiler-optimizer.cjs');
function checkConfig(c){
 assert.equal(c.solc,'0.8.37'); assert.equal(c.optimizer,true); assert.equal(c.optimizer_runs,40);
 assert.equal(c.via_ir,true); assert.equal(c.evm_version,'shanghai');
 assert.deepEqual(c.optimizer_details,{yulDetails:{optimizerSteps:OPTIMIZER_STEPS}});
}
function checkMetadata(m){
 assert.equal(m.compiler.version,'0.8.37+commit.f401782d');
 assert.equal(m.settings.viaIR,true); assert.equal(m.settings.evmVersion,'shanghai');
 assert.deepEqual(m.settings.optimizer, {runs:40,details:{peephole:true,inliner:true,jumpdestRemover:true,orderLiterals:true,deduplicate:true,cse:true,constantOptimizer:true,yul:true,yulDetails:{stackAllocation:true,optimizerSteps:OPTIMIZER_STEPS},simpleCounterForLoopUncheckedIncrement:true}});
}
function checkInput(b){
 assert.equal(b.solcLongVersion,'0.8.37');
 assert.equal(b.input.settings.viaIR,true);assert.equal(b.input.settings.evmVersion,'shanghai');
 assert.deepEqual(b.input.settings.optimizer,require('../../hardhat/compiler-optimizer.cjs').optimizer);
}
if(require.main===module){
 const [configPath,artifactPath,buildInfoDirectory]=process.argv.slice(2);
 if(!configPath||!artifactPath||!buildInfoDirectory)throw Error('Expected Forge config JSON, compiled AGIJobManager artifact and build-info directory');
 checkConfig(JSON.parse(fs.readFileSync(configPath,'utf8')));
 const a=JSON.parse(fs.readFileSync(artifactPath,'utf8'));
 checkMetadata(typeof a.metadata==='string'?JSON.parse(a.metadata):a.metadata);
 let checked=0;
 for(const name of fs.readdirSync(buildInfoDirectory).filter(n=>n.endsWith('.json'))){
  const b=JSON.parse(fs.readFileSync(path.join(buildInfoDirectory,name),'utf8'));
  if(b.input?.sources?.['contracts/AGIJobManager.sol']){checkInput(b);checked++;}
 }
 assert.ok(checked>0,'Missing AGIJobManager Standard JSON build input');
 console.log('Forge parsed configuration and compiled metadata preserve the exact SOL-2026-7 workaround profile.');
}
module.exports={checkConfig,checkMetadata,checkInput};
