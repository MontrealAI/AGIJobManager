import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', '..');
const outRootArg = process.argv.find((arg) => arg.startsWith('--out-dir='));
const outRoot = outRootArg ? path.resolve(repoRoot, outRootArg.split('=')[1]) : repoRoot;
const outFile = path.join(outRoot, 'docs/REFERENCE/EVENTS_AND_ERRORS.md');

const contractPath = path.join(repoRoot, 'contracts/AGIJobManager.sol');
const source = fs.readFileSync(contractPath, 'utf8');
const sourceFingerprint = crypto.createHash('sha256').update(source).digest('hex').slice(0, 12);

const stripComments = (text) => text
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/\/\/.*$/gm, '');

const cleaned = stripComments(source);

const events = [...cleaned.matchAll(/^\s*event\s+(\w+)\s*\(([^)]*)\)\s*;/gm)]
  .map((m) => ({ name: m[1], args: m[2].replace(/\s+/g, ' ').trim() || '—' }))
  .sort((a, b) => a.name.localeCompare(b.name));

const errors = [...cleaned.matchAll(/^\s*error\s+(\w+)\s*\(([^)]*)\)\s*;/gm)]
  .map((m) => ({ name: m[1], args: m[2].replace(/\s+/g, ' ').trim() || '—' }))
  .sort((a, b) => a.name.localeCompare(b.name));

const monitoringHint = (eventName) => {
  if (/Created|Applied/.test(eventName)) return 'Track new liabilities and bond locks.';
  if (/CompletionRequested|Validated|Disapproved/.test(eventName)) return 'Monitor review-window progress and validator participation.';
  if (/Dispute|Paused|Blacklist|Moderator/.test(eventName)) return 'Trigger high-priority operational/governance alerts.';
  if (/Completed|Expired|Cancelled/.test(eventName)) return 'Reconcile escrow release and terminal status accounting.';
  if (/Withdraw|Treasury/.test(eventName)) return 'Treasury movement; review against change-management approvals.';
  return 'Index for audit trail completeness and anomaly detection.';
};

const remediationHint = (errorName) => {
  if (/Not|Unauthorized|Only/.test(errorName)) return 'Use the correct role signer and verify allowlist/ownership requirements.';
  if (/State|Status|Window|Expired|Deadline/.test(errorName)) return 'Re-check lifecycle getters and timing windows before retrying.';
  if (/Blacklist/.test(errorName)) return 'Review blacklist policy, incident context, and off-chain identity evidence.';
  if (/Transfer|Balance|Escrow|Withdraw/.test(errorName)) return 'Validate token approvals/balances and locked accounting buckets.';
  if (/Proof|Merkle|ENS|Subdomain/.test(errorName)) return 'Recompute proof/ownership data and verify resolver/namewrapper configuration.';
  return 'Inspect input parameters, prerequisites, and current configuration before retrying.';
};

const content = `# Events and Errors Reference (Generated)\n\n- Source snapshot fingerprint: \`${sourceFingerprint}\`.\n- Source: \`contracts/AGIJobManager.sol\`.\n\n## Events catalog\n\n| Event | Parameters | Monitoring note |\n| --- | --- | --- |\n${events.map((e) => `| \`${e.name}\` | ${e.args === '—' ? '—' : `\`${e.args}\``} | ${monitoringHint(e.name)} |`).join('\n')}\n\n## Errors catalog\n\n| Error | Parameters | Operator remediation |\n| --- | --- | --- |\n${errors.map((e) => `| \`${e.name}\` | ${e.args === '—' ? '—' : `\`${e.args}\``} | ${remediationHint(e.name)} |`).join('\n')}\n\n## Operational note\n\nUse this index with [docs/OPERATIONS/MONITORING.md](../OPERATIONS/MONITORING.md) for alert routing and with [docs/OPERATIONS/INCIDENT_RESPONSE.md](../OPERATIONS/INCIDENT_RESPONSE.md) for runbook actions.\n`;

fs.mkdirSync(path.dirname(outFile), { recursive: true });
fs.writeFileSync(outFile, content);
console.log(`Generated ${path.relative(repoRoot, outFile)}`);
