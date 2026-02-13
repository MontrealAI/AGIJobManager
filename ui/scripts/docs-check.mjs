import fs from 'node:fs';
import path from 'node:path';
const required = ['OVERVIEW.md','ARCHITECTURE.md','JOB_LIFECYCLE.md','SECURITY_MODEL.md','DESIGN_SYSTEM.md','DEMO.md','TESTING.md','RUNBOOK.md','VERSIONS.md'];
const docsDir = path.resolve(process.cwd(), '../docs/ui');
for (const f of required) if (!fs.existsSync(path.join(docsDir, f))) throw new Error(`missing ${f}`);
const arch = fs.readFileSync(path.join(docsDir,'ARCHITECTURE.md'),'utf8');
const lifecycle = fs.readFileSync(path.join(docsDir,'JOB_LIFECYCLE.md'),'utf8');
if (!arch.includes('```mermaid')) throw new Error('ARCHITECTURE missing mermaid');
if (!lifecycle.includes('stateDiagram-v2')) throw new Error('JOB_LIFECYCLE missing state diagram');
if (arch.includes('data:image') || lifecycle.includes('data:image')) throw new Error('Forbidden data:image');
for (const g of ['palette-plate.svg','dashboard-plate.svg','jobs-plate.svg','job-detail-plate.svg','admin-plate.svg','design-plate.svg']) {
  if (!fs.existsSync(path.join(docsDir,'graphics',g))) throw new Error(`missing graphic ${g}`);
}
console.log('docs-check passed');
