import { readFile } from 'node:fs/promises';
import { policyDigest } from '../src/envelope.mjs';
if (process.argv.length !== 4) throw new Error('Usage: node scripts/policy-digest.mjs reviewed-policy.json independently-reviewed-unsigned-hash');
const review = JSON.parse(await readFile(process.argv[2], 'utf8'));
process.stdout.write(`${policyDigest(review, process.argv[3])}\n`);
