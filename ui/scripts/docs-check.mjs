import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
const root = path.resolve(process.cwd(), '..');
const required = ['OVERVIEW.md','ARCHITECTURE.md','JOB_LIFECYCLE.md','SECURITY_MODEL.md','DESIGN_SYSTEM.md','DEMO.md','TESTING.md','RUNBOOK.md','VERSIONS.md'];
for (const f of required){ if(!fs.existsSync(path.join(root,'docs/ui',f))) throw new Error(`Missing docs/ui/${f}`); }
const arch = fs.readFileSync(path.join(root,'docs/ui/ARCHITECTURE.md'),'utf8');
if(!arch.includes('```mermaid')) throw new Error('ARCHITECTURE.md missing mermaid');
const life = fs.readFileSync(path.join(root,'docs/ui/JOB_LIFECYCLE.md'),'utf8');
if(!life.includes('stateDiagram-v2')) throw new Error('JOB_LIFECYCLE missing state diagram');
for (const f of fs.readdirSync(path.join(root,'docs/ui/graphics'))) { const c=fs.readFileSync(path.join(root,'docs/ui/graphics',f),'utf8'); if(c.includes('data:image')) throw new Error('Forbidden data:image'); }
const expected = execSync('node scripts/generate-versions.mjs',{cwd:process.cwd()}).toString();
console.log(expected.trim());
console.log('docs-check passed');
