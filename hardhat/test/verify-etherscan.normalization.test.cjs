'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { publishedInputMatchesBuild: matches } = require('../scripts/explorer-input-comparison.cjs');
const A = '0x'+'a'.repeat(40), B='0x'+'b'.repeat(40);
function fixture() {
  const expected={language:'Solidity',sources:{'L.sol':{content:'library L {}'},'T.sol':{content:'contract T {}'}},
    settings:{optimizer:{enabled:true,runs:40},viaIR:true,evmVersion:'shanghai',metadata:{bytecodeHash:'none'},
      outputSelection:{'*':{'*':['abi']}},libraries:{'L.sol':{L:A},'T.sol':{Unused:B}}}};
  const artifact={sourceName:'T.sol',linkReferences:{'L.sol':{L:[{start:10,length:20}]}},deployedLinkReferences:{}};
  const published=structuredClone(expected);published.settings.libraries={'L.sol':{L:A}};
  return {expected,artifact,published};
}
test('Etherscan output selection and omitted unused links do not change source identity',()=>{
 const f=fixture();f.published.settings.outputSelection={'*':{'*':['metadata','abi']}};
 assert.equal(matches(f.published,f.expected,f.artifact),true);
});
test('every effective linked library address is binding; missing and extra links are rejected',()=>{
 for(const change of [p=>p.settings.libraries['L.sol'].L=B,p=>delete p.settings.libraries['L.sol'].L,p=>p.settings.libraries['L.sol'].Extra=B]){
  const f=fixture();change(f.published);assert.equal(matches(f.published,f.expected,f.artifact),false);
 }
});
test('standalone library cannot acquire an unexpected published dependency',()=>{
 const f=fixture();f.artifact.linkReferences={};assert.equal(matches(f.published,f.expected,f.artifact),false);
 f.published.settings.libraries={};assert.equal(matches(f.published,f.expected,f.artifact),true);
});
test('source text and code-affecting settings remain exact',()=>{
 for(const change of [p=>p.sources['T.sol'].content+=' ',p=>p.settings.viaIR=false,p=>p.settings.optimizer.runs=41,
   p=>p.settings.metadata.bytecodeHash='ipfs',p=>delete p.sources['L.sol']]){
  const f=fixture();change(f.published);assert.equal(matches(f.published,f.expected,f.artifact),false);
 }
});
test('malformed library addresses, maps and references fail closed',()=>{
 for(const refs of [null,[],{'L.sol':{L:[]}},{'L.sol':{L:[{start:-1,length:20}]}}]){
  const f=fixture();f.artifact.linkReferences=refs;assert.equal(matches(f.published,f.expected,f.artifact),false);
 }
 const f=fixture();f.published.settings.libraries['L.sol'].L='0x12';assert.equal(matches(f.published,f.expected,f.artifact),false);
});
test('legacy fixtures without references require all configured libraries',()=>{
 const f=fixture();assert.equal(matches(f.published,f.expected,{}),false);
 f.published.settings.libraries=structuredClone(f.expected.settings.libraries);assert.equal(matches(f.published,f.expected,{}),true);
});

test('partial artifact link maps cannot authorize grouped aliases or omit configured runtime dependencies',()=>{
 for(const field of ['linkReferences','deployedLinkReferences']){
  const f=fixture();delete f.artifact[field];f.published.settings.libraries={'T.sol':{L:A}};
  assert.equal(matches(f.published,f.expected,f.artifact),false);
  f.published.settings.libraries=structuredClone(f.expected.settings.libraries);
  assert.equal(matches(f.published,f.expected,f.artifact),true);
 }
});
test('malformed link positions and output selection are rejected before normalization',()=>{
 for(const pos of [{start:1,length:1},{start:1,length:21},{start:Number.MAX_SAFE_INTEGER,length:20}]){
  const f=fixture();f.artifact.linkReferences['L.sol'].L=[pos];assert.equal(matches(f.published,f.expected,f.artifact),false);
 }
 for(const selection of [null,'invalid',[],{'*':null},{'*':{'*':'abi'}},{'*':{'*':[42]}}]){
  const f=fixture();f.published.settings.outputSelection=selection;assert.equal(matches(f.published,f.expected,f.artifact),false);
 }
});
