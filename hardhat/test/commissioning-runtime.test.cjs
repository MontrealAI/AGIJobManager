'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const {createRequire}=require('node:module');
const {spawnSync}=require('node:child_process');
const L=require('../../scripts/commissioning/lib/runtime.cjs');
const {fixture,write,snapshot}=require('./fixtures/commissioning/synthetic-project.cjs');
const use=fn=>{const f=fixture();try{return fn(f);}finally{f.cleanup();}};
test('reproduces missing config-relative package resolution in the original external workspace',()=>use(f=>{
  const installed=L.inspectInstalled(f.repo);assert.match(installed.version,/fixture$/);
  assert.throws(()=>L.dependencyPackageJson(path.join(f.work,'hardhat.config.mjs'),'hardhat'),/INSTALLED_DEPENDENCY_NOT_FOUND/);
}));
test('old layout reaches a synthetic HHE22 guard even when invoked from the repository cwd',()=>use(f=>{
  const h=L.inspectInstalled(f.repo);
  const r=spawnSync(process.execPath,[h.cli,'--config',path.join(f.work,'hardhat.config.mjs'),'run','--no-compile','nothing.mjs'],{cwd:f.repo,env:{PATH:process.env.PATH},encoding:'utf8'});
  assert.equal(r.status,1);assert.match(r.stderr,/HHE22 synthetic reproduction/);
}));
test('a workspace-only link resolves the identical installed Hardhat and ethers plugin realpaths',()=>use(f=>{
  const h=L.inspectInstalled(f.repo),before=snapshot(f.repo);L.linkInstalledDependencies(h,f.work);
  assert.equal(L.assertSameRuntime(h,f.work),true);
  assert.equal(L.dependencyPackageJson(path.join(f.work,'hardhat.config.mjs'),'hardhat'),h.hardhatJson);
  assert.deepEqual(snapshot(f.repo),before);
}));
test('works when package exports hide package.json',()=>use(f=>{
  assert.throws(()=>createRequire(path.join(f.repo,'package.json')).resolve('hardhat/package.json'),/exports/);
  const h=L.inspectInstalled(f.repo);L.linkInstalledDependencies(h,f.work);assert.equal(L.assertSameRuntime(h,f.work),true);
}));
test('works with an existing symlinked installation without copying or updating it',()=>use(f=>{
  const modules=path.join(f.repo,'node_modules'),actual=path.join(f.base,'shared modules','node_modules');
  fs.mkdirSync(path.dirname(actual));
  fs.renameSync(modules,actual);fs.symlinkSync(actual,modules,'dir');
  const h=L.inspectInstalled(f.repo);L.linkInstalledDependencies(h,f.work);assert.equal(L.assertSameRuntime(h,f.work),true);
  assert.equal(fs.realpathSync(path.join(f.work,'node_modules','hardhat')),path.join(actual,'hardhat'));
}));
test('never overwrites an existing workspace node_modules directory',()=>use(f=>{
  fs.mkdirSync(path.join(f.work,'node_modules'));const h=L.inspectInstalled(f.repo);
  assert.throws(()=>L.linkInstalledDependencies(h,f.work),/REFUSING_EXISTING/);
}));
test('never replaces an existing dangling workspace node_modules link',()=>use(f=>{
  fs.symlinkSync('/nonexistent-test-target',path.join(f.work,'node_modules'),'dir');const h=L.inspectInstalled(f.repo);
  assert.throws(()=>L.linkInstalledDependencies(h,f.work),/REFUSING_EXISTING/);
  assert.equal(fs.readlinkSync(path.join(f.work,'node_modules')),'/nonexistent-test-target');
}));
test('refuses a workspace inside the protected repository',()=>use(f=>{
  const work=path.join(f.repo,'work');fs.mkdirSync(work);const before=snapshot(f.repo);
  assert.throws(()=>L.linkInstalledDependencies(L.inspectInstalled(f.repo),work),/OUTSIDE_REPOSITORY/);assert.deepEqual(snapshot(f.repo),before);
}));
test('refuses a non-private or non-ESM workspace',()=>use(f=>{
  write(path.join(f.work,'package.json'),'{"type":"commonjs","private":true}');
  assert.throws(()=>L.linkInstalledDependencies(L.inspectInstalled(f.repo),f.work),/PRIVATE_ESM/);
}));
test('detects package substitution between the startup check and fork launch',()=>use(f=>{
  const h=L.inspectInstalled(f.repo);L.linkInstalledDependencies(h,f.work);
  fs.rmSync(path.join(f.work,'node_modules'),{recursive:true});
  write(path.join(f.work,'node_modules/hardhat/package.json'),'{"name":"hardhat"}');
  assert.throws(()=>L.assertSameRuntime(h,f.work),/HARDHAT_MISMATCH/);
}));
test('refuses an unexpected Hardhat major version',()=>use(f=>{
  const p=path.join(f.hardhat,'package.json'),j=JSON.parse(fs.readFileSync(p));j.version='2.22.0';write(p,JSON.stringify(j));
  assert.throws(()=>L.inspectInstalled(f.repo),/HARDHAT_3_REQUIRED/);
}));
test('refuses a CLI path outside the installed Hardhat package',()=>use(f=>{
  const p=path.join(f.hardhat,'package.json'),j=JSON.parse(fs.readFileSync(p));j.bin={hardhat:'../elsewhere.js'};write(p,JSON.stringify(j));write(path.join(f.hardhat,'../elsewhere.js'),'');
  assert.throws(()=>L.inspectInstalled(f.repo),/UNEXPECTED_HARDHAT_CLI_PATH/);
}));
test('refuses a missing ethers plugin rather than installing a replacement',()=>use(f=>{
  fs.rmSync(path.join(f.repo,'node_modules/@nomicfoundation/hardhat-ethers'),{recursive:true});
  assert.throws(()=>L.inspectInstalled(f.repo),/Cannot find module|INSTALLED_DEPENDENCY_NOT_FOUND/);
}));
test('installed runtime guard is never bypassed and frozen connection source is preserved',()=>{
  const root=path.resolve(__dirname,'../..'),crypto=require('node:crypto');
  const source=fs.readFileSync(path.join(root,'scripts/commissioning/lib/rehearsal.cjs'),'utf8')+fs.readFileSync(path.join(root,'scripts/commissioning/lib/runtime.cjs'),'utf8');
  assert.doesNotMatch(source,/allowNonlocalHardhatInstallation|HARDHAT_EXPERIMENTAL_ALLOW_NON_LOCAL_INSTALLATION/);
  assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path.join(root,'hardhat/scripts/check-ens-usdc-connection.cjs'))).digest('hex'),'ee05e43469e62e9de35ce07f96909e17f4f086eaa2f1781930912eaecdeecdc2');
});

function useLayout(layout,fn){const f=fixture("success",layout);try{return fn(f);}finally{f.cleanup();}}
test('selects the subproject Hardhat and plugin together, while retaining solc from repository root',()=>useLayout('split',f=>{
  const h=L.inspectInstalled(f.repo);
  assert.equal(h.layout,'hardhat-subproject');assert.equal(h.peerInstancesMatched,true);
  assert.ok(h.cli.startsWith(path.join(f.repo,'hardhat/node_modules/hardhat/')));
  assert.ok(h.entries['@nomicfoundation/hardhat-ethers'].startsWith(path.join(f.repo,'hardhat/node_modules/')));
  assert.ok(h.entries.solc.startsWith(path.join(f.repo,'node_modules/solc/')));
  const before=snapshot(f.repo),linked=L.linkInstalledDependencies(h,f.work);
  write(path.join(f.work,'LOCAL_RUNTIME.json'),JSON.stringify(linked));
  const active=L.requireWorkspaceRuntime(f.repo,f.work);
  assert.deepEqual(active.installed.entries,h.entries);
  for(const name of L.NAMES)assert.equal(active.local.resolve(name),h.entries[name]);
  assert.deepEqual(snapshot(f.repo),before);
}));
test('supports subproject plugin with a genuinely hoisted Hardhat without inventing another installation',()=>useLayout('hoisted',f=>{
  const h=L.inspectInstalled(f.repo);assert.equal(h.layout,'hardhat-subproject');
  assert.ok(h.cli.startsWith(path.join(f.repo,'node_modules/hardhat/')));
  L.linkInstalledDependencies(h,f.work);assert.equal(L.assertSameRuntime(h,f.work),true);
}));
test('same-version duplicate Hardhat under the plugin fails peer-instance validation',()=>useLayout('split',f=>{
  const nested=path.join(f.repo,'hardhat/node_modules/@nomicfoundation/hardhat-ethers/node_modules/hardhat');
  fs.mkdirSync(path.dirname(nested),{recursive:true});fs.cpSync(f.hardhat,nested,{recursive:true});
  assert.throws(()=>L.inspectInstalled(f.repo),/PLUGIN_HARDHAT_PEER_INSTANCE_MISMATCH/);
}));
test('same-version duplicate ethers under the plugin fails peer-instance validation',()=>useLayout('split',f=>{
  const nested=path.join(f.repo,'hardhat/node_modules/@nomicfoundation/hardhat-ethers/node_modules/ethers');
  fs.mkdirSync(path.dirname(nested),{recursive:true});fs.cpSync(path.join(f.repo,'node_modules/ethers'),nested,{recursive:true});
  assert.throws(()=>L.inspectInstalled(f.repo),/PLUGIN_ETHERS_PEER_INSTANCE_MISMATCH/);
}));
test('an invalid subproject manifest stops rather than silently switching to root',()=>useLayout('split',f=>{
  write(path.join(f.repo,'hardhat/package.json'),'{broken');
  assert.throws(()=>L.inspectInstalled(f.repo),SyntaxError);
}));
test('a missing compiler remains an error and never triggers installation',()=>useLayout('split',f=>{
  fs.rmSync(path.join(f.repo,'node_modules/solc'),{recursive:true});
  assert.throws(()=>L.inspectInstalled(f.repo),e=>e.code==='MODULE_NOT_FOUND'&&e.missingModule==='solc');
}));
test('workspace compiler link cannot be redirected to a different installed copy',()=>useLayout('split',f=>{
  const h=L.inspectInstalled(f.repo);L.linkInstalledDependencies(h,f.work);
  const link=path.join(f.work,'node_modules/solc');fs.unlinkSync(link);
  const other=path.join(f.base,'other-solc');fs.cpSync(h.packages.solc.directory,other,{recursive:true});fs.symlinkSync(other,link,'dir');
  assert.throws(()=>L.assertSameRuntime(h,f.work),/TEMP_PROJECT_(MODULE|METADATA)_MISMATCH/);
}));
test('manifest drift and entry-byte drift are detected even when realpaths remain unchanged',()=>useLayout('split',f=>{
  const h=L.inspectInstalled(f.repo);L.linkInstalledDependencies(h,f.work);
  const file=h.entries.ethers;fs.appendFileSync(file,'\nexports.changed=true;\n');
  assert.throws(()=>L.assertSameRuntime(h,f.work),/INSTALLED_RUNTIME_CHANGED/);
}));
test('recorded runtime fingerprint cannot select another project or package after startup',()=>useLayout('split',f=>{
  const h=L.inspectInstalled(f.repo),linked=L.linkInstalledDependencies(h,f.work);
  linked.installedFingerprint.version='3.17.99';write(path.join(f.work,'LOCAL_RUNTIME.json'),JSON.stringify(linked));
  assert.throws(()=>L.requireWorkspaceRuntime(f.repo,f.work),/WORKSPACE_RUNTIME_SELECTION_CHANGED/);
}));
