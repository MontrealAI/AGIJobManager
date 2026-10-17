import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { checkPreservation, verifyBinding, digest } from './explicit-pages-preservation.mjs';
const write = (root, name, value) => { const p = path.join(root, name); fs.mkdirSync(path.dirname(p), {recursive:true}); fs.writeFileSync(p, typeof value === 'string' ? value : JSON.stringify(value)); };
// Synthetic unit fixtures test invariants only. They never run as legacy or produce source qualification.
function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'pages-invariant-unit-'));
  write(root, 'scripts/successor/preservation-normalize.mjs', 'export const normalizeConsole = x => x.replace(/TIME=[0-9]+/, "TIME=");');
  write(root, 'console.html', 'TIME=42 stable');
  write(root, 'contract.sol', 'new');
  write(root, 'diagram.md', '```mermaid\ngraph TD; A-->B;\n```');
  write(root, 'docs/successor/PRESERVATION_BASELINE.json', {
    protectedFiles:{'contract.sol':digest('old'),'console.html':digest('old console')},
    normalizedConsoleFiles:{'console.html':digest('TIME= stable')},
    mermaidBlocks:{'diagram.md':[digest('```mermaid\ngraph TD; A-->B;\n```')]}, routes:['index.html','fr/index.html']});
  write(root, 'config/next-deployment-contract-changes.json', {files:{}, evidenceInputs:{}});
  write(root, 'config/explicit-governor-source-v1.json', {changedContracts:{'contract.sol':{beforeSha256:digest('old'), afterSha256:digest('new'), reason:'unit fixture'}}});
  write(root, 'config/mainnet/agi-jobs-usdc.json', {activation:{intakeActivationAuthorized:false,gates:[1,2,3,4,5]}});
  for (const lang of ['', 'fr/']) {
    write(root, `build/pages/${lang}index.html`, 'data-successor-entry="home" href="./successor/"');
    write(root, `build/pages/${lang}successor/index.html`, `connect-src 'none' sandbox=""`);
  }
  write(root, 'build/pages/assets/test.txt', 'inventory');
  write(root, 'build/pages/.nojekyll', '');
  refresh(root);
  return root;
}
function refresh(root) {
  const names = ['index.html','fr/index.html','successor/index.html','fr/successor/index.html','assets/test.txt'];
  write(root, 'build/pages/build-info.json', {sourceCommit:'9066d1270613f2c4529d5eef8eca3c4ed9bf9e48',buildOnlyFiles:{'.nojekyll':{bytes:0,sha256:digest('')}},files:Object.fromEntries(names.filter(n => fs.existsSync(path.join(root,'build/pages',n))).map(n => {const b = fs.readFileSync(path.join(root,'build/pages',n)); return [n,{bytes:b.length,sha256:digest(b)}];}))});
}
async function withFixture(fn) {const root=fixture(); try {await fn(root);} finally {fs.rmSync(root,{recursive:true,force:true});}}
test('unit fixture preserves all source and Pages invariants', () => withFixture(async r => assert.equal((await checkPreservation(r)).releaseQualified,false)));
const mutations = {
  'missing historical route': r => fs.unlinkSync(path.join(r,'build/pages/fr/index.html')),
  'missing bilingual Builder': r => fs.unlinkSync(path.join(r,'build/pages/fr/successor/index.html')),
  'wrong inventory bytes': r => write(r,'build/pages/assets/test.txt','tampered'),
  'omitted inventory entry': r => {const p=path.join(r,'build/pages/build-info.json');const j=JSON.parse(fs.readFileSync(p));delete j.files['assets/test.txt'];write(r,'build/pages/build-info.json',j);},
  'missing CSP': r => {write(r,'build/pages/successor/index.html','sandbox=""');refresh(r);},
  'missing sandbox': r => {write(r,'build/pages/successor/index.html',"connect-src 'none'");refresh(r);},
  'missing bilingual entry': r => {write(r,'build/pages/fr/index.html','home');refresh(r);},
  'oversized Builder': r => {write(r,'build/pages/successor/index.html',`connect-src 'none' sandbox=""${'x'.repeat(750000)}`);refresh(r);},
  'activated intake': r => write(r,'config/mainnet/agi-jobs-usdc.json',{activation:{intakeActivationAuthorized:true,gates:[1,2,3,4,5]}}),
  'missing activation gate': r => write(r,'config/mainnet/agi-jobs-usdc.json',{activation:{intakeActivationAuthorized:false,gates:[1,2,3,4]}}),
  'normalized console changed': r => write(r,'console.html','TIME=43 changed'),
  'diagram removed': r => write(r,'diagram.md','diagram removed'),
  'historical before hash overridden': r => write(r,'config/explicit-governor-source-v1.json',{changedContracts:{'contract.sol':{beforeSha256:digest('other'),afterSha256:digest('new'),reason:'unit fixture'}}}),
  'symlink substitution': r => {fs.unlinkSync(path.join(r,'build/pages/assets/test.txt'));fs.symlinkSync('/etc/hostname',path.join(r,'build/pages/assets/test.txt'));},
};
for(const [name, mutate] of Object.entries(mutations)) test('rejects '+name, () => withFixture(async r => {mutate(r);await assert.rejects(checkPreservation(r));}));
test('binding cannot be replaced even with a syntactically valid profile', () => withFixture(r => {
  const f=path.join(r,'binding.json');write(r,'binding.json',{profile:'manager-explicit-governor-v1'});
  assert.throws(()=>verifyBinding(r,undefined,f),/unreviewed external binding/);
}));
test('missing binding fails closed', () => withFixture(r => assert.throws(()=>verifyBinding(r,undefined,path.join(r,'missing.json')))));
// Opt-in integration runs mutate and restore only the dedicated disposable checkout.
// CI uses its isolated source checkout; never point this at an operator's worktree.
if (process.env.EXPLICIT_PAGES_TEST_SOURCE) {
  const root = process.env.EXPLICIT_PAGES_TEST_SOURCE;
  const deps = process.env.EXPLICIT_PAGES_TEST_DEPENDENCIES;
  test('exact frozen source passes bound validation', () => assert.equal(verifyBinding(root,deps).releaseQualified,false));
  for (const name of [
    'scripts/release/check-source-boundaries.py', 'scripts/release/check-explicit-governor-boundaries.py',
    'config/explicit-governor-source-v1.json', 'schemas/explicit-governor-source-v1.schema.json',
    'package-lock.json', 'hardhat/package-lock.json', 'ui/package-lock.json',
    'contracts/AGIJobManager.sol', 'scripts/successor/preservation.test.mjs',
    'docs/qualification/mainnet-cutover-next-deployment.json',
  ]) test('bound source rejects changed ' + name, () => {
    const p=path.join(root,name), bytes=fs.readFileSync(p);
    try { fs.appendFileSync(p,'\n'); assert.throws(()=>verifyBinding(root,deps)); }
    finally {fs.writeFileSync(p,bytes);}
  });
  for (const name of ['contracts/Unexpected.sol','scripts/qualification/ignored-extra.pyc']) test('bound source rejects extra ' + name, () => {
    const p=path.join(root,name); assert.ok(!fs.existsSync(p));
    try {fs.writeFileSync(p,'unexpected');assert.throws(()=>verifyBinding(root,deps));}
    finally {fs.unlinkSync(p);}
  });
  test('bound source rejects symlink substitution', () => {
    const p=path.join(root,'contracts/AGIJobManager.sol'), bytes=fs.readFileSync(p), mode=fs.statSync(p).mode;
    const saved=path.join(os.tmpdir(),'pages-contract-'+process.pid);fs.writeFileSync(saved,bytes);
    try {fs.unlinkSync(p);fs.symlinkSync(saved,p);assert.throws(()=>verifyBinding(root,deps));}
    finally {fs.unlinkSync(p);fs.writeFileSync(p,bytes,{mode});fs.unlinkSync(saved);}
  });
}
