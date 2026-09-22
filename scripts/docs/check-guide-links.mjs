import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {activeGuides} from './check-current-guides.mjs';
export function headings(text){
 const ids=new Set(),counts=new Map();let fence=false;
 for(const line of text.split('\n')){
  if(/^\s*(```|~~~)/.test(line)){fence=!fence;continue;}if(fence)continue;
  for(const m of line.matchAll(/(?:id|name)=["']([^"']+)["']/g))ids.add(m[1]);
  const m=line.match(/^#{1,6}\s+(.+?)\s*#*$/);if(!m)continue;
  const base=m[1].replace(/\[([^\]]+)\]\([^)]+\)/g,'$1').replace(/<[^>]*>/g,'').replace(/&amp;/g,'&').toLowerCase().replace(/[^\p{L}\p{N}\p{M}_ -]/gu,'').replace(/ /g,'-');
  const count=counts.get(base)||0;counts.set(base,count+1);ids.add(base+(count?'-'+count:''));
 }
 return ids;
}
export function brokenLinks(root,files){
 const errors=[],cache=new Map();
 for(const name of files){const text=fs.readFileSync(path.join(root,name),'utf8').replace(/^\s*(```|~~~)[^\n]*\n[\s\S]*?^\s*\1\s*$/gm,'');
  for(const m of text.matchAll(/\[[^\]]*\]\(([^\s)]+)\)/g)){
   const href=m[1];if(/^[a-z]+:/i.test(href)||href.startsWith('//'))continue;
   const [file,anchor]=href.split('#'),target=path.resolve(root,path.dirname(name),decodeURIComponent(file.split('?')[0]||path.basename(name)));
   if(!fs.existsSync(target)){errors.push(name+' -> '+href+' (missing file)');continue;}
   if(!anchor||!target.endsWith('.md'))continue;
   if(!cache.has(target))cache.set(target,headings(fs.readFileSync(target,'utf8')));
   if(!cache.get(target).has(decodeURIComponent(anchor)))errors.push(name+' -> '+href+' (missing heading)');
  }
 }
 return errors;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..'),files=activeGuides(root),errors=brokenLinks(root,files);
 if(errors.length){errors.forEach(x=>console.error(x));process.exitCode=1;}else console.log('Local file and heading links passed for '+files.length+' current guides.');
}
