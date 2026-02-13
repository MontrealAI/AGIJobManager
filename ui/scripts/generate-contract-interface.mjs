import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..', '..');
const abiPath = path.join(repoRoot, 'ui', 'src', 'abis', 'agiJobManager.ts');
const outPath = path.join(repoRoot, 'docs', 'ui', 'CONTRACT_INTERFACE.md');

const source = fs.readFileSync(abiPath, 'utf8');
const match = source.match(/export const agiJobManagerAbi = (\[[\s\S]*\]) as const;/);
if (!match) {
  throw new Error('Unable to parse agiJobManagerAbi from ui/src/abis/agiJobManager.ts');
}

const abi = JSON.parse(match[1]);
const functions = abi.filter((i) => i.type === 'function').map((i) => `${i.name} (${i.stateMutability})`);
const events = abi.filter((i) => i.type === 'event').map((i) => i.name);
const errors = abi.filter((i) => i.type === 'error').map((i) => i.name);

const now = new Date().toISOString();
const md = `# UI Contract Interface Snapshot\n\nThis file is **auto-generated** from \`ui/src/abis/agiJobManager.ts\`.\n\n- Generated at: ${now}\n- Source ABI: \`ui/src/abis/agiJobManager.ts\`\n\n## Functions used by UI\n\n${functions.map((f) => `- ${f}`).join('\n')}\n\n## Events used by UI\n\n${events.map((e) => `- ${e}`).join('\n')}\n\n## Custom errors decoded by UI\n\n${errors.map((e) => `- ${e}`).join('\n')}\n\n## UI compatibility contract\n\nThe UI assumes the selected AGIJobManager deployment exposes all functions, events, and custom errors listed above.\nIf contract interfaces drift, regenerate this file and update UI call sites + tests before release.\n`;

fs.writeFileSync(outPath, md, 'utf8');
console.log(`Wrote ${outPath}`);
