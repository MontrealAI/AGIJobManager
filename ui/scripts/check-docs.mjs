import fs from 'node:fs';
const required = [
  '../../docs/ui/ARCHITECTURE.md',
  '../../docs/ui/JOB_LIFECYCLE.md',
  '../../docs/ui/screenshots/dashboard.svg',
  '../../docs/ui/screenshots/jobs.svg',
  '../../docs/ui/screenshots/job-detail.svg',
  '../../docs/ui/screenshots/admin.svg'
];
for (const file of required) {
  if (!fs.existsSync(new URL(file, import.meta.url))) {
    throw new Error(`Missing required doc artifact: ${file}`);
  }
}
const versions = fs.readFileSync(new URL('../../docs/ui/VERSIONS.md', import.meta.url), 'utf8');
if (!versions.includes('Last generated:')) throw new Error('VERSIONS.md is stale. Run npm run docs:versions');
console.log('docs:check passed');
