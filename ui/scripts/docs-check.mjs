import fs from 'node:fs';
const mustDocs = ['OVERVIEW.md','ARCHITECTURE.md','JOB_LIFECYCLE.md','SECURITY_MODEL.md','DESIGN_SYSTEM.md','DEMO.md','TESTING.md','VERSIONS.md'];
for (const f of mustDocs){
  if(!fs.existsSync(`../docs/ui/${f}`)) throw new Error(`Missing docs/ui/${f}`);
}
const readme = fs.readFileSync('../docs/ui/OVERVIEW.md','utf8');
if(!readme.includes('```mermaid')) throw new Error('Mermaid diagram missing in OVERVIEW');
const shots=['dashboard.svg','jobs-list.svg','job-detail.svg','admin-console.svg'];
for (const s of shots) if(!fs.existsSync(`../docs/ui/screenshots/${s}`)) throw new Error(`Missing screenshot ${s}`);
console.log('docs:check passed');
