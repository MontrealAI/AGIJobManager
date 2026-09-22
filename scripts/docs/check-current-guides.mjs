import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
export function auditGuide(text,{version,scripts}){
 const errors=[];
 for(const m of text.matchAll(/\[([^\]]+)\]\((https:\/\/github\.com\/MontrealAI\/AGIJobManager\/(?:releases\/(?:tag|download)|blob)\/v(\d+\.\d+\.\d+)[^)]*)\)/g)){
  const labels=[...m[1].matchAll(/\bv(\d+\.\d+\.\d+)\b/g)].map(x=>x[1]);
  if(labels.some(x=>x!==m[3]))errors.push('Release link label differs from its target: '+m[1]);
  if(m[2].includes('/releases/download/')&&m[3]!==version)errors.push('Current download points to another edition: '+m[2]);
 }
 for(const m of text.matchAll(/(?:Current (?:software )?edition|Current application|Current release)\s*:?\s*\*{0,2}\[?v?(\d+\.\d+\.\d+)/gi))if(m[1]!==version)errors.push('Stale current edition: '+m[1]);
 for(const m of text.matchAll(/npm\s+(?:--prefix\s+([\w./-]+)\s+)?run\s+([\w:-]+)/g)){
  const prefix=m[1]?.replace(/^\.\//,'').replace(/\/$/,''),name=m[2];
  if(prefix&&Object.hasOwn(scripts,prefix)){if(!scripts[prefix].has(name))errors.push('Unknown '+prefix+' command: '+name);}
  else if(!prefix&&!Object.values(scripts).some(s=>s.has(name)))errors.push('Unknown npm command: '+name);
 }
 for(const line of text.split('\n')){
  if(/historical|retired|recovery|disabled|no new|not the current/i.test(line))continue;
  if(/(?:new (?:live |automated )?work|current private intake).{0,90}(?:schema [1-5]\b|retainer policies)|(?:current upgrade.{0,40}review retainers)|confirmed collection before paid Node work/i.test(line))errors.push('Obsolete live admission instruction: '+line.slice(0,140));
 }
 return [...new Set(errors)];
}
export function activeGuides(root){
 const files=['README.md','hardhat/README.md','ui/README.md'];
 function walk(dir){for(const e of fs.readdirSync(path.join(root,dir),{withFileTypes:true})){const p=dir+'/'+e.name;if(e.isDirectory()){if(!['releases','qualification','LEGAL','security'].includes(e.name))walk(p);}else if(e.name.endsWith('.md'))files.push(p);}}
 walk('docs');return files.filter(p=>!/^#.*(?:superseded|historical|retired|legacy)/i.test(fs.readFileSync(path.join(root,p),'utf8').split('\n')[0]));
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..'),pkg=JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8'));
 const scripts=Object.fromEntries(['','hardhat','ui'].map(dir=>[dir,new Set(Object.keys(JSON.parse(fs.readFileSync(path.join(root,dir,'package.json'),'utf8')).scripts))]));
 const files=activeGuides(root);let failures=0;
 for(const name of files)for(const problem of auditGuide(fs.readFileSync(path.join(root,name),'utf8'),{version:pkg.version,scripts})){console.error(name+': '+problem);failures++;}
 if(failures)process.exitCode=1;else console.log('Current guide audit passed: '+files.length+' guides; release labels, policy instructions and npm commands.');
}
