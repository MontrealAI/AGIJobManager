import fs from 'node:fs';
import path from 'node:path';
const repoRoot = path.resolve(process.cwd(), '..');
const config = JSON.parse(fs.readFileSync(path.join(repoRoot, 'config/usdc-deployment.json'), 'utf8'));
const output = path.join(process.cwd(), 'src/generated/deployments.ts');
const content = `// Generated from config/usdc-deployment.json. Never infer deployment from historical receipts.
export const OFFICIAL_DEPLOYMENTS = ${JSON.stringify(config, null, 2)} as const;
`;
if (process.argv.includes('--check')) {
  if (fs.readFileSync(output, 'utf8') !== content) throw new Error('Run npm run sync:deployments and commit the result.');
} else fs.writeFileSync(output, content);
