const assert=require('node:assert/strict');
describe('Current documentation drift regression',()=>{
 let audit,options;
 before(async()=>{audit=(await import('../scripts/docs/check-current-guides.mjs')).auditGuide;options={version:'1.9.1',scripts:{'':new Set(['docs:check']),'hardhat':new Set(['recover:review-escrow:mainnet']),'ui':new Set(['typecheck'])}};});
 it('rejects an old visible label even when the download URL is current',()=>assert.ok(audit('[v1.6.1 complete package](https://github.com/MontrealAI/AGIJobManager/releases/download/v1.9.1/AGIJobManager-v1.9.1-COMPLETE.zip)',options).length));
 it('rejects a current-edition claim buried in body text',()=>assert.ok(audit('# Guide\n\n**Current edition: v1.6.1.**',options).length));
 it('preserves correctly linked historical release identities',()=>assert.deepEqual(audit('[v1.6.1](https://github.com/MontrealAI/AGIJobManager/releases/tag/v1.6.1)',options),[]));
 it('rejects an obsolete download even if its label agrees',()=>assert.ok(audit('[v1.8.0](https://github.com/MontrealAI/AGIJobManager/releases/download/v1.8.0/archive.zip)',options).length));
 it('requires an explicit prefix command to exist in that workspace',()=>assert.ok(audit('npm --prefix hardhat run typecheck',options).length));
 it('accepts the actual recovery command and rejects a removed deployment command',()=>{assert.deepEqual(audit('npm --prefix hardhat run recover:review-escrow:mainnet',options),[]);assert.ok(audit('npm --prefix hardhat run deploy:review-escrow:mainnet',options).length);});
 it('distinguishes live-retainer instructions from preserved recovery notes',()=>{assert.ok(audit('Current upgrade: review retainers and calibration',options).length);assert.deepEqual(audit('Historical retainer policies remain for recovery; new funding is disabled.',options),[]);});
});

describe('Current guide anchor checks',()=>{
 it('recognizes duplicate headings and excludes fenced example headings',async()=>{
  const {headings}=await import('../scripts/docs/check-guide-links.mjs');
  const ids=headings('## A `command`\n## A command\n```md\n## Example only\n```\n<a id="explicit"></a>');
  assert.deepEqual([...ids],['a-command','a-command-1','explicit']);
 });
 it('rejects a missing heading even when the target file exists',async()=>{
  const {brokenLinks}=await import('../scripts/docs/check-guide-links.mjs');
  const fs=await import('node:fs'),os=await import('node:os'),path=await import('node:path');
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'agi-guide-'));
  try{fs.writeFileSync(path.join(root,'guide.md'),'# Guide\n[correct](#guide) [stale](#removed)');assert.deepEqual(brokenLinks(root,['guide.md']),['guide.md -> #removed (missing heading)']);}finally{fs.rmSync(root,{recursive:true,force:true});}
 });
});
