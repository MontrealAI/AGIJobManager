const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const html=fs.readFileSync(require('node:path').join(__dirname,'../ui/agijobmanager-usdc.html'),'utf8');
const start=html.indexOf('function persistAccessState('),end=html.indexOf('function restoreAccessState(',start);
function setup() {
 const fields={agentSub:{value:''},clubSub:{value:''},mintAlphaLabel:{value:''},walletStatus:{textContent:'wallet'},chainStatus:{textContent:'chain'}};
 let saved={agentSub:'newer-agent',clubSub:'newer-club',mintAlphaLabel:'newer-mint'};
 const ctx=vm.createContext({byId:id=>fields[id],verified:{},writeSession:patch=>{saved={...saved,...patch};}});vm.runInContext(html.slice(start,end),ctx);
 return {ctx,fields,saved:()=>saved};
}
describe('Session persistence during asynchronous wallet refresh',()=>{
 it('updates wallet hints without overwriting newer saved access input',()=>{const x=setup();x.ctx.persistAccessState({hintsOnly:true});assert.equal(x.saved().agentSub,'newer-agent');assert.equal(x.saved().clubSub,'newer-club');assert.equal(x.saved().mintAlphaLabel,'newer-mint');assert.equal(x.saved().accountHint,'wallet');});
 it('still saves explicit user edits including clearing input',()=>{const x=setup();x.fields.agentSub.value='edited';x.ctx.persistAccessState();assert.equal(x.saved().agentSub,'edited');assert.equal(x.saved().clubSub,'');assert.equal(Object.hasOwn(x.saved(),'termsAccepted'),false);});
});
