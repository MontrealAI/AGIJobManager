import fs from 'node:fs';
import path from 'node:path';
const repoRoot = path.resolve(process.cwd(), '..');
const config = JSON.parse(fs.readFileSync(path.join(repoRoot, 'config/usdc-deployment.json'), 'utf8'));
const record = JSON.parse(fs.readFileSync(path.join(repoRoot, 'config/mainnet/agi-jobs-usdc.json'), 'utf8'));
const recorded = { chainId: record.chainId, manager: record.manager, helper: record.helper, namespace: record.jobsRootName, block: record.connection.snapshot.number, blockHash: record.connection.snapshot.hash, recordDate: record.recordDate, activation: record.activation.decision };
const output = path.join(process.cwd(), 'src/generated/deployments.ts');
const content = `// Generated from config/usdc-deployment.json. Never infer deployment from historical receipts.
export const OFFICIAL_DEPLOYMENTS = ${JSON.stringify(config, null, 2)} as const;

// Historical display only; never a transaction default.
export const RECORDED_MAINNET_INSTANCE = ${JSON.stringify(recorded, null, 2)} as const;
`;
if (process.argv.includes('--check')) {
  if (fs.readFileSync(output, 'utf8') !== content) throw new Error('Run npm run sync:deployments and commit the result.');
} else fs.writeFileSync(output, content);
