'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {checkConfig,checkMetadata}=require('./check-forge-optimizer.cjs');
const {OPTIMIZER_STEPS}=require('../../hardhat/compiler-optimizer.cjs');
const config=()=>({solc:'0.8.37',optimizer:true,optimizer_runs:40,via_ir:true,evm_version:'shanghai',optimizer_details:{yulDetails:{optimizerSteps:OPTIMIZER_STEPS}}});
const metadata=()=>({compiler:{version:'0.8.37+commit.f401782d'},settings:{viaIR:true,evmVersion:'shanghai',optimizer:{runs:40,details:{peephole:true,inliner:true,jumpdestRemover:true,orderLiterals:true,deduplicate:true,cse:true,constantOptimizer:true,yul:true,yulDetails:{stackAllocation:true,optimizerSteps:OPTIMIZER_STEPS},simpleCounterForLoopUncheckedIncrement:true}}}});
test('exact parsed Forge and emitted compiler metadata accepted',()=>{checkConfig(config());checkMetadata(metadata());});
test('silently discarded snake-case details rejected',()=>{const c=config();c.optimizer_details={};assert.throws(()=>checkConfig(c));});
test('altered compiler, runs, IR, EVM and pass sequence rejected',()=>{
 for(const [k,v] of [['solc','0.8.36'],['optimizer',false],['optimizer_runs',200],['via_ir',false],['evm_version','cancun']]){const c=config();c[k]=v;assert.throws(()=>checkConfig(c));}
 for(const steps of [OPTIMIZER_STEPS+'L',OPTIMIZER_STEPS+'E',OPTIMIZER_STEPS.replace(':',':L')]){const m=metadata();m.settings.optimizer.details.yulDetails.optimizerSteps=steps;assert.throws(()=>checkMetadata(m));}
 const m=metadata();delete m.settings.optimizer.details;assert.throws(()=>checkMetadata(m));
});
test('emitted Standard JSON input is exact and rejects restored affected passes',()=>{
 const {checkInput}=require('./check-forge-optimizer.cjs');
 const b={solcLongVersion:'0.8.37',input:{settings:{viaIR:true,evmVersion:'shanghai',optimizer:structuredClone(require('../../hardhat/compiler-optimizer.cjs').optimizer)}}};
 checkInput(b);b.input.settings.optimizer.details.yulDetails.optimizerSteps+='L';assert.throws(()=>checkInput(b));
});
