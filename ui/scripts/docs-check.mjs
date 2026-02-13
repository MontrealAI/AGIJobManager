import fs from 'node:fs';
import path from 'node:path';
const base = path.resolve(process.cwd(), '..', 'docs', 'ui');
const reqDocs = ['OVERVIEW.md','ARCHITECTURE.md','JOB_LIFECYCLE.md','SECURITY_MODEL.md','DESIGN_SYSTEM.md','DEMO.md','TESTING.md','VERSIONS.md'];
for (const f of reqDocs) if (!fs.existsSync(path.join(base, f))) throw new Error(`Missing docs/ui/${f}`);
const overview = fs.readFileSync(path.join(base, 'OVERVIEW.md'),'utf8');
for (const ref of ['dashboard.svg','jobs-list.svg','job-detail.svg','admin.svg']) {
  if (!overview.includes(ref)) throw new Error(`OVERVIEW missing screenshot reference ${ref}`);
  if (!fs.existsSync(path.join(base, 'screenshots', ref))) throw new Error(`Missing screenshot asset ${ref}`);
}
for (const f of ['ARCHITECTURE.md','JOB_LIFECYCLE.md']) {
  const c=fs.readFileSync(path.join(base, f),'utf8');
  if(!c.includes('```mermaid')) throw new Error(`${f} missing mermaid block`);
}
console.log('docs check passed');
