const assert=require('node:assert/strict');
const fs=require('node:fs');
const core=require('../scripts/economics/computer-work.cjs');
function fixture(){const s=JSON.parse(fs.readFileSync('examples/computer-work-v2.json'));s.profile='computer-work/v3';s.dataPolicy='confidential';s.inputs=[{name:'source.csv',mediaType:'text/csv',uri:'agi-local://source/source.csv',sha256:'f'.repeat(64),maxBytes:8192}];for(const f of s.inputs)f.uri='agi-local://staged-input/'+f.name;for(const role of ['agent','reviewer'])s.authority[role].scope='dedicated-account';s.privacy={recipientKeyIds:['a'.repeat(64)],retentionSeconds:86400,publicDisclosure:'commitment-only',modelProcessing:'approved-provider'};s.execution={maxWallSeconds:604800,leaseSeconds:30,maxResumes:10,retryBudget:2};s.permissions=Object.fromEntries(['agent','reviewer'].map(r=>[r,{enforcement:'whole-account',allowedActions:['screenshot','type'],capabilityHandles:['account-opaque'],externalEffects:['whole-account-interaction'],expiresAt:s.deadline}]));return s;}
describe('Confidential computer-work v3',()=>{
 it('admits explicit private handles and a multi-day budget without pretending an adapter is ready',()=>{const s=fixture();s.budget.maxAgentSeconds=172800;assert.equal(core.validateComputerWork(s),s);});
 for(const [name,mutate] of [
 ['plaintext publication',s=>s.privacy.publicDisclosure='public-files'],
 ['credential-bearing input URL',s=>s.inputs[0].uri='https://user:password@host/file'],
 ['traversal in a staged handle',s=>s.inputs[0].uri='agi-local://account/../secret'],
 ['implicit whole-account effects',s=>s.permissions.agent.externalEffects=[]],
 ['write disguised as observe-only',s=>s.permissions.agent.enforcement='observe-only'],
 ['unbounded retry count',s=>s.execution.retryBudget=1001],
 ['insufficient wall budget',s=>s.execution.maxWallSeconds=1],
 ['missing encrypted recipients',s=>s.privacy.recipientKeyIds=[]]
 ])it('rejects '+name,()=>{const s=fixture();mutate(s);assert.throws(()=>core.validateComputerWork(s),/COMPUTER_/);});
 it('exports only commitments and no supplied plaintext',()=>{const c=core.privateCommitment({specSha256:'a'.repeat(64),runtimeSha256:'b'.repeat(64),encryptedSha256:'c'.repeat(64),receiptSha256:'d'.repeat(64),recipientPolicySha256:'e'.repeat(64),plaintext:'secret'});assert(!JSON.stringify(c).includes('secret'));assert.equal(c.disclosure,'commitments-only');});
});
