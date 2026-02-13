import fs from 'node:fs';
const requiredDocs = ['OVERVIEW.md','ARCHITECTURE.md','JOB_LIFECYCLE.md','SECURITY_MODEL.md','DESIGN_SYSTEM.md','DEMO.md','TESTING.md','VERSIONS.md'];
for (const f of requiredDocs) {
  if (!fs.existsSync(new URL(`../../docs/ui/${f}`, import.meta.url))) throw new Error(`Missing docs/ui/${f}`);
}
const refs = ['dashboard.svg','jobs-list.svg','job-detail.svg','admin.svg'];
for (const f of refs) {
  if (!fs.existsSync(new URL(`../../docs/ui/screenshots/${f}`, import.meta.url))) throw new Error(`Missing screenshot ${f}`);
}
const arch = fs.readFileSync(new URL('../../docs/ui/ARCHITECTURE.md', import.meta.url), 'utf8');
if (!arch.includes('```mermaid')) throw new Error('ARCHITECTURE.md missing mermaid block');
console.log('docs check passed');
