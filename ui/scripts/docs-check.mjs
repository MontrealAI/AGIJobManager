import fs from 'node:fs';
import path from 'node:path';

const required = ['OVERVIEW.md','ARCHITECTURE.md','JOB_LIFECYCLE.md','SECURITY_MODEL.md','DESIGN_SYSTEM.md','DEMO.md','TESTING.md','RUNBOOK.md','VERSIONS.md'];
const base = path.resolve(process.cwd(), '../docs/ui');
for (const name of required) {
  const p = path.join(base, name);
  if (!fs.existsSync(p)) throw new Error(`missing ${name}`);
}

const architecture = fs.readFileSync(path.join(base, 'ARCHITECTURE.md'), 'utf8');
if (!architecture.includes('```mermaid')) throw new Error('ARCHITECTURE.md missing mermaid block');
const lifecycle = fs.readFileSync(path.join(base, 'JOB_LIFECYCLE.md'), 'utf8');
if (!lifecycle.includes('stateDiagram-v2')) throw new Error('JOB_LIFECYCLE.md missing state diagram');

const graphics = ['palette-plate.svg','dashboard-wireframe.svg','jobs-wireframe.svg','job-detail-wireframe.svg','admin-wireframe.svg','design-wireframe.svg'];
for (const file of graphics) {
  if (!fs.existsSync(path.join(base, 'graphics', file))) throw new Error(`missing graphic ${file}`);
}

for (const file of required) {
  const text = fs.readFileSync(path.join(base, file), 'utf8');
  if (text.includes('data:image')) throw new Error(`forbidden data:image in ${file}`);
}

const pkg = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), 'package.json')));
const versions = fs.readFileSync(path.join(base, 'VERSIONS.md'), 'utf8');
if (!versions.includes(`| next | ${pkg.dependencies.next} |`)) throw new Error('VERSIONS.md stale for next');

console.log('docs-check passed');
