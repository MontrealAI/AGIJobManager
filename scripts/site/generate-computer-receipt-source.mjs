// SPDX-License-Identifier: MIT
// Generate only exact reviewed portable sources, never code supplied by a receipt.
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {build} from 'esbuild';
const root=fileURLToPath(new URL('../../',import.meta.url));
const target=path.join(root,'site/assets/computer-receipt/vendor/jobs-computer');
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
export async function snapshot(source,commit){
  if(!path.isAbsolute(source)||fs.realpathSync(source)!==source||!/^[a-f0-9]{40}$/.test(commit))throw Error('EXACT_JOBS_SOURCE_REQUIRED');
  const git=(...args)=>execFileSync('/usr/bin/git',['--no-replace-objects','-c','core.fsmonitor=false','-C',source,...args],{encoding:'utf8',env:{PATH:'/usr/bin:/bin',GIT_CONFIG_GLOBAL:'/dev/null',GIT_CONFIG_SYSTEM:'/dev/null',GIT_CONFIG_NOSYSTEM:'1'}}).trim();
  const entry='integrations/alpha-agent/four-repo-computer-receipt.mjs';
  const result=await build({absWorkingDir:source,entryPoints:[entry],bundle:true,platform:'browser',format:'esm',target:'es2022',write:false,metafile:true,logLevel:'silent'});
  const files=new Map(),manifest={schema:'agijobmanager/jobs-computer-browser-source/v1',repository:'MontrealAI/AGIJobsv0',commit,tree:git('rev-parse',commit+'^{tree}'),entry,files:{}};
  for(const relative of [...new Set([...Object.keys(result.metafile.inputs),'LICENSE'])].sort()){
    const file=path.resolve(source,relative);if(!file.startsWith(source+path.sep)||fs.realpathSync(file)!==file||!fs.lstatSync(file).isFile())throw Error('REGULAR_JOBS_SOURCE_REQUIRED');
    const object=git('rev-parse',commit+':'+relative),bytes=execFileSync('/usr/bin/git',['--no-replace-objects','-C',source,'cat-file','blob',object],{maxBuffer:8_388_608});
    if(!bytes.equals(fs.readFileSync(file)))throw Error('JOBS_SOURCE_BYTES_CHANGED:'+relative);
    files.set(relative,bytes);manifest.files[relative]={bytes:bytes.length,sha256:hash(bytes),gitBlob:object};
  }
  files.set('source-manifest.json',Buffer.from(JSON.stringify(manifest,null,2)+'\n'));return {manifest,files};
}
export function verify(files,directory=target){
  const actual=[];function walk(current){for(const entry of fs.readdirSync(current,{withFileTypes:true})){const file=path.join(current,entry.name);if(entry.isSymbolicLink())throw Error('VENDOR_LINK');if(entry.isDirectory())walk(file);else{if(!entry.isFile())throw Error('VENDOR_NONREGULAR');const name=path.relative(directory,file).split(path.sep).join('/');actual.push(name);if(!files.get(name)?.equals(fs.readFileSync(file)))throw Error('VENDOR_BYTES:'+name);}}}walk(directory);
  if(JSON.stringify(actual.sort())!==JSON.stringify([...files.keys()].sort()))throw Error('VENDOR_COVERAGE');
}
export function browserSources(){
  const directory=path.join(root,'site/assets/computer-receipt'),sources={schema:'agijobmanager/computer-receipt-browser-sources/v1',receivers:{},files:{}};
  for(const name of ['alpha-computer','jobs-computer']){
    const base=path.join(directory,'vendor',name),manifest=JSON.parse(fs.readFileSync(path.join(base,'source-manifest.json')));
    sources.receivers[name]={repository:manifest.repository,commit:manifest.commit,tree:manifest.tree,entry:manifest.entry};
    const expected=[...Object.keys(manifest.files),'source-manifest.json',...(name==='alpha-computer'?['source-identity.mjs']:[])].sort(),actual=[];
    function walk(current){for(const entry of fs.readdirSync(current,{withFileTypes:true})){const file=path.join(current,entry.name);if(entry.isSymbolicLink())throw Error('BROWSER_RECEIVER_LINK');if(entry.isDirectory())walk(file);else{if(!entry.isFile())throw Error('BROWSER_RECEIVER_NONREGULAR');actual.push(path.relative(base,file).split(path.sep).join('/'));}}}walk(base);
    if(JSON.stringify(actual.sort())!==JSON.stringify(expected))throw Error('BROWSER_RECEIVER_COVERAGE');
    for(const relative of expected){
      const file=path.join(base,relative);if(!fs.lstatSync(file).isFile()||fs.realpathSync(file)!==file)throw Error('REGULAR_BROWSER_RECEIVER_REQUIRED');
      const bytes=fs.readFileSync(file),record=manifest.files[relative];if(record&&(bytes.length!==record.bytes||hash(bytes)!==record.sha256||createHash('sha1').update('blob '+bytes.length+'\0').update(bytes).digest('hex')!==record.gitBlob))throw Error('BROWSER_RECEIVER_BYTES_CHANGED');
      if(relative==='source-identity.mjs'&&!bytes.equals(Buffer.from('export default '+JSON.stringify(manifest,null,2)+';\n')))throw Error('BROWSER_RECEIVER_IDENTITY_CHANGED');
      sources.files['vendor/'+name+'/'+relative]={bytes:bytes.length,sha256:hash(bytes)};
    }
  }
  return JSON.stringify(sources,null,2)+'\n';
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
  const [source,commit,mode]=process.argv.slice(2);if(process.argv.length!==5||!['--write','--check'].includes(mode))throw Error('EXACT_SOURCE_COMMIT_AND_WRITE_OR_CHECK_REQUIRED');
  const value=await snapshot(source,commit);
  if(mode==='--write'){fs.rmSync(target,{recursive:true,force:true});for(const [name,bytes]of value.files){const file=path.join(target,name);fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,bytes);}}
  verify(value.files);const sources=browserSources(),file=path.join(root,'site/assets/computer-receipt/sources.json');if(mode==='--write')fs.writeFileSync(file,sources);else if(fs.readFileSync(file,'utf8')!==sources)throw Error('BROWSER_SOURCES_MANIFEST_CHANGED');console.log(JSON.stringify({source:value.manifest.commit,files:value.files.size,exactNativeBytes:true}));
}
