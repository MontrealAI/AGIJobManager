const test=require('node:test'),assert=require('node:assert/strict');
const {settings}=require('../scripts/deploy-review-escrow.cjs');
const {requireArtifactMatch}=require('../scripts/deployment-safety.cjs');
test('review deployment defaults to read-only and requires explicit deployment pins',()=>{
 const env={JOB_MANAGER:'0x'+'1'.repeat(40),JOB_MANAGER_CODE_HASH:'0x'+'2'.repeat(64)};
 assert.equal(settings(env).dryRun,true);assert.throws(()=>settings({...env,DRY_RUN:'nope'}));assert.throws(()=>settings({...env,DRY_RUN:'0'}),/VERIFY_RPC_URL/);assert.throws(()=>settings({...env,CONFIRMATIONS:'1'}));assert.throws(()=>settings({}),/CODE_HASH/);
});
test('review deployment verifier substitutes only the two known immutable slots',()=>{
 const manager='0x'+'1'.repeat(40),token='0x'+'2'.repeat(40),artifact={contractName:'AGIReviewEscrow',sourceName:'Review.sol',deployedBytecode:'0x'+'00'.repeat(64)},buildInfo={output:{contracts:{'Review.sol':{AGIReviewEscrow:{evm:{deployedBytecode:{immutableReferences:{11:[{start:0,length:32}],12:[{start:32,length:32}]}}}}}},sources:{'Review.sol':{ast:{nodes:[{nodeType:'ContractDefinition',name:'AGIReviewEscrow',nodes:[{id:11,nodeType:'VariableDeclaration',mutability:'immutable',name:'manager'},{id:12,nodeType:'VariableDeclaration',mutability:'immutable',name:'usdcToken'}]}]}}}}};
 const code='0x'+manager.slice(2).padStart(64,'0')+token.slice(2).padStart(64,'0');
 requireArtifactMatch({artifact,buildInfo,managerAddress:manager,tokenAddress:token,code});
 assert.throws(()=>requireArtifactMatch({artifact,buildInfo,managerAddress:token,tokenAddress:manager,code}),/differs/);
 assert.throws(()=>requireArtifactMatch({artifact,buildInfo,tokenAddress:token,code}),/pins/);
 buildInfo.output.sources['Review.sol'].ast.nodes[0].nodes[0].name='unreviewed';assert.throws(()=>requireArtifactMatch({artifact,buildInfo,managerAddress:manager,tokenAddress:token,code}),/Unrecognized/);
});
