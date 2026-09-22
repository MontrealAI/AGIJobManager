import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const json=p=>JSON.parse(fs.readFileSync(path.join(root,p),'utf8'));
const pkg=json('package.json'),c=json('config/companion-releases.json');
if(c.public!==pkg.version)throw Error('Companion map public edition differs from package.json');
const values={VERSION:pkg.version,TAG:'v'+pkg.version,FLEET:c.fleet,AGENT:c.agent,NODE:c.node,PUBLIC_NODE:pkg.engines.node};
const outputs=new Map();
for(const [template,dest] of [['README.md.tpl','README.md'],['PRIVATE_FLEET.md.tpl','docs/OPERATIONS/PRIVATE_FLEET.md'],['V1_RELEASE_SCOPE.md.tpl','docs/V1_RELEASE_SCOPE.md']]){
 const s=fs.readFileSync(path.join(root,'scripts/docs/templates',template),'utf8').replace(/\{\{([A-Z_]+)\}\}/g,(_,key)=>{if(!(key in values))throw Error('Unknown template field '+key);return values[key];});
 outputs.set(dest,s);
}
let commands='# Complete npm command inventory\n\n<!-- Generated from package.json scripts by scripts/docs/current-release.mjs. -->\n\nUse [the script guide](../SCRIPTS_REFERENCE.md) for purpose and authority and [the release guide](../RELEASE_GUIDE.md) for deployment/recovery steps. The command below always runs from the repository root. A listed command is not permission to broadcast.\n';
for(const dir of ['','hardhat','ui']){
 commands+='\n## '+(dir||'Root')+' workspace\n\n| Command from repository root | Exact configured implementation |\n| --- | --- |\n';
 for(const [name,script] of Object.entries(json((dir?dir+'/':'')+'package.json').scripts).sort(([a],[b])=>a.localeCompare(b)))commands+='| `npm '+(dir?'--prefix '+dir+' ':'')+'run '+name+'` | `'+script.replaceAll('|','\\|')+'` |\n';
}
outputs.set('docs/REFERENCE/COMMANDS.md',commands);
let failed=false;
for(const [dest,expected] of outputs){const p=path.join(root,dest);if(process.argv.includes('--write'))fs.writeFileSync(p,expected);else if(!fs.existsSync(p)||fs.readFileSync(p,'utf8')!==expected){console.error('Current guide is stale: '+dest+'; run npm run docs:gen');failed=true;}}
if(failed)process.exitCode=1;else console.log('Current README, companion editions and complete command inventory agree with package metadata.');
