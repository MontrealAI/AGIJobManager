'use strict';
const fs = require('node:fs');
const path = require('node:path');
const {createRequire} = require('node:module');
const {createHash} = require('node:crypto');
const {ensure, hash, compare} = require('./isolation.cjs');
const NAMES = Object.freeze(['hardhat', '@nomicfoundation/hardhat-ethers', 'ethers', 'dotenv', 'solc']);

// Fingerprint the complete installed trees, including transitive modules and
// native binaries. Hashing just manifests/entrypoints misses secondary imports.
// This detects drift from the reviewed installation, not package authenticity.
function fingerprintInstallation(repo, {maxFiles=100000, maxBytes=2*1024*1024*1024}={}) {
  const roots=[...new Set([path.join(repo,'node_modules'),path.join(repo,'hardhat/node_modules')]
    .filter(present).map(p=>fs.realpathSync(p)))];
  const inside=p=>roots.some(root=>p===root||p.startsWith(root+path.sep));
  let fileCount=0, byteCount=0;
  const buffer=Buffer.alloc(65536);
  return roots.map(root=>{
    const digest=createHash('sha256');let files=0,bytes=0;
    const visit=directory=>{
      for(const name of fs.readdirSync(directory).sort()){
        const file=path.join(directory,name),stat=fs.lstatSync(file),relative=path.relative(root,file);
        ensure(++fileCount<=maxFiles,'INSTALLED_RUNTIME_FILE_LIMIT');
        digest.update(JSON.stringify([relative,stat.mode&0o777,stat.isDirectory()?'directory':stat.isSymbolicLink()?'link':'file'])+'\n');
        if(stat.isDirectory()){visit(file);continue;}
        if(stat.isSymbolicLink()){
          ensure(inside(fs.realpathSync(file)),'INSTALLED_RUNTIME_LINK_OUTSIDE_TREES');
          digest.update(JSON.stringify(fs.readlinkSync(file))+'\n');continue;
        }
        ensure(stat.isFile(),'INSTALLED_RUNTIME_SPECIAL_FILE_REFUSED');
        byteCount+=stat.size;bytes+=stat.size;files++;
        ensure(byteCount<=maxBytes,'INSTALLED_RUNTIME_BYTE_LIMIT');
        digest.update(String(stat.size)+'\n');
        const fd=fs.openSync(file,fs.constants.O_RDONLY|fs.constants.O_NOFOLLOW);
        try{
          const before=fs.fstatSync(fd);let count=0,n;
          ensure(before.isFile()&&before.ino===stat.ino&&before.size===stat.size,'INSTALLED_RUNTIME_CHANGED_DURING_HASH');
          while((n=fs.readSync(fd,buffer,0,buffer.length,null))>0){count+=n;ensure(count<=stat.size,'INSTALLED_RUNTIME_CHANGED_DURING_HASH');digest.update(buffer.subarray(0,n));}
          const after=fs.fstatSync(fd);
          ensure(count===stat.size&&after.size===before.size&&after.mtimeMs===before.mtimeMs,'INSTALLED_RUNTIME_CHANGED_DURING_HASH');
        }finally{fs.closeSync(fd);}
        digest.update('\n');
      }
    };
    visit(root);return {root,sha256:digest.digest('hex'),files,bytes};
  });
}

function present(file) {
  try { fs.lstatSync(file); return true; } catch (e) { if (e.code === 'ENOENT') return false; throw e; }
}
function dependencyPackageJson(from, name) {
  ensure(path.isAbsolute(from), 'ABSOLUTE_MODULE_ORIGIN_REQUIRED');
  const req = createRequire(from.endsWith(path.sep) ? from + '__resolver__.cjs' : from);
  for (const lookup of req.resolve.paths(name) || []) {
    const candidate = path.join(lookup, ...name.split('/'), 'package.json');
    if (present(candidate)) return fs.realpathSync(candidate);
  }
  const error = new Error('INSTALLED_DEPENDENCY_NOT_FOUND');
  error.code = 'MODULE_NOT_FOUND'; error.missingModule = name; throw error;
}
function packageRecord(origin, name) {
  const req = createRequire(origin);
  let entry;
  try { entry = fs.realpathSync(req.resolve(name)); }
  catch (e) { if (e.code === 'MODULE_NOT_FOUND') e.missingModule = name; throw e; }
  const packageJson = dependencyPackageJson(origin, name);
  const bytes = fs.readFileSync(packageJson), pkg = JSON.parse(bytes);
  const directory = path.dirname(packageJson);
  ensure(pkg.name === name && typeof pkg.version === 'string', 'INSTALLED_PACKAGE_METADATA_INVALID');
  ensure(entry.startsWith(directory + path.sep) && fs.statSync(entry).isFile(), 'PACKAGE_ENTRY_OUTSIDE_PACKAGE');
  return {entry, packageJson, directory, version:pkg.version, manifestSha256:hash(bytes), entrySha256:hash(fs.readFileSync(entry))};
}
function inspectInstalled(repo) {
  const root = fs.realpathSync(repo);
  const subManifest = path.join(root, 'hardhat', 'package.json');
  // A declared Hardhat subproject is authoritative. Do not search unrelated
  // global installations or silently fall back after a broken subproject read.
  const origin = present(subManifest) ? subManifest : path.join(root, 'package.json');
  const originBytes = fs.readFileSync(origin);
  const manifest = JSON.parse(originBytes);
  ensure(manifest && typeof manifest === 'object' && !Array.isArray(manifest), 'PROJECT_MANIFEST_INVALID');
  const packages = Object.fromEntries(NAMES.map(name => [name, packageRecord(origin, name)]));
  const hh = packages.hardhat, plugin = packages['@nomicfoundation/hardhat-ethers'];
  ensure(/^3\./.test(hh.version), 'HARDHAT_3_REQUIRED');
  ensure(/^4\./.test(plugin.version), 'HARDHAT_ETHERS_4_REQUIRED');
  const pkg = JSON.parse(fs.readFileSync(hh.packageJson, 'utf8'));
  const bin = typeof pkg.bin === 'string' ? pkg.bin : pkg.bin?.hardhat;
  ensure(typeof bin === 'string' && bin.length > 0 && !path.isAbsolute(bin), 'HARDHAT_CLI_NOT_FOUND');
  const cli = fs.realpathSync(path.resolve(hh.directory, bin));
  ensure(cli.startsWith(hh.directory + path.sep) && fs.statSync(cli).isFile(), 'UNEXPECTED_HARDHAT_CLI_PATH');
  const entries = Object.fromEntries(NAMES.map(name => [name, packages[name].entry]));
  // Same version is not enough: separate installations can load separate HREs.
  const peerRequire = createRequire(plugin.entry);
  ensure(fs.realpathSync(peerRequire.resolve('hardhat')) === entries.hardhat, 'PLUGIN_HARDHAT_PEER_INSTANCE_MISMATCH');
  ensure(fs.realpathSync(peerRequire.resolve('ethers')) === entries.ethers, 'PLUGIN_ETHERS_PEER_INSTANCE_MISMATCH');
  const dependencyTrees=fingerprintInstallation(root);
  ensure(Object.values(packages).every(p=>dependencyTrees.some(t=>p.directory.startsWith(t.root+path.sep))), 'INSTALLED_PACKAGE_OUTSIDE_REVIEWED_TREES');
  return {repo:root, origin, originSha256:hash(originBytes), layout:origin === subManifest ? 'hardhat-subproject' : 'repository-root',
    hardhatJson:hh.packageJson, version:hh.version, cli, cliSha256:hash(fs.readFileSync(cli)), entries, packages,
    dependencyTrees,peerInstancesMatched:true};
}
function assertSameRuntime(installed, work) {
  const config = path.join(work, 'hardhat.config.mjs');
  ensure(dependencyPackageJson(config, 'hardhat') === installed.hardhatJson, 'TEMP_PROJECT_HARDHAT_MISMATCH');
  const req = createRequire(config);
  for (const [name, expected] of Object.entries(installed.entries)) {
    ensure(fs.realpathSync(req.resolve(name)) === expected, 'TEMP_PROJECT_MODULE_MISMATCH');
    ensure(dependencyPackageJson(config, name) === installed.packages[name].packageJson, 'TEMP_PROJECT_METADATA_MISMATCH');
  }
  compare(inspectInstalled(installed.repo), installed, 'INSTALLED_RUNTIME_CHANGED');
  return true;
}
function linkInstalledDependencies(installed, work) {
  const realWork = fs.realpathSync(work);
  ensure(realWork !== installed.repo && !realWork.startsWith(installed.repo + path.sep), 'WORKSPACE_MUST_BE_OUTSIDE_REPOSITORY');
  const manifest = JSON.parse(fs.readFileSync(path.join(realWork, 'package.json'), 'utf8'));
  ensure(manifest.private === true && manifest.type === 'module', 'PRIVATE_ESM_WORKSPACE_REQUIRED');
  const directory = path.join(realWork, 'node_modules');
  ensure(!present(directory), 'REFUSING_EXISTING_WORKSPACE_NODE_MODULES');
  // Per-package links preserve split/hoisted layouts (e.g. solc at the root).
  // They exist only in the new workspace; installed dependency bytes are not copied.
  fs.mkdirSync(directory, {mode:0o700});
  try {
    for (const name of NAMES) {
      const link = path.join(directory, ...name.split('/'));
      fs.mkdirSync(path.dirname(link), {recursive:true, mode:0o700});
      fs.symlinkSync(installed.packages[name].directory, link, 'dir');
    }
    assertSameRuntime(installed, realWork);
  } catch(e) { fs.rmSync(directory, {recursive:true, force:true}); throw e; }
  return {method:'temporary-workspace-per-package-links', selectionOrigin:installed.origin, layout:installed.layout,
    packageLinks:Object.fromEntries(NAMES.map(name => [name, installed.packages[name].directory])),
    hardhatVersion:installed.version, hardhatPackageJson:installed.hardhatJson, cli:installed.cli,
    sameHardhatAndEthersPlugin:true, peerInstancesMatched:true, repositoryFilesModified:false,
    installedFingerprint:installed};
}
function requireWorkspaceRuntime(repo, work) {
  const record = JSON.parse(fs.readFileSync(path.join(work, 'LOCAL_RUNTIME.json'), 'utf8'));
  const installed = inspectInstalled(repo);
  compare(installed, record.installedFingerprint, 'WORKSPACE_RUNTIME_SELECTION_CHANGED');
  assertSameRuntime(installed, work);
  return {installed, local:createRequire(path.join(work, 'hardhat.config.mjs'))};
}
module.exports = {NAMES, dependencyPackageJson, fingerprintInstallation, inspectInstalled, assertSameRuntime, linkInstalledDependencies, requireWorkspaceRuntime};
