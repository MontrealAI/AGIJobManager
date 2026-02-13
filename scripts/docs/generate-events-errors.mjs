import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', '..');
const outRootArg = process.argv.find((arg) => arg.startsWith('--out-dir='));
const outRoot = outRootArg ? path.resolve(repoRoot, outRootArg.split('=')[1]) : repoRoot;
const outFile = path.join(outRoot, 'docs/REFERENCE/EVENTS_AND_ERRORS.md');
const srcPath = path.join(repoRoot, 'contracts/AGIJobManager.sol');
const src = fs.readFileSync(srcPath, 'utf8');
const sourceFingerprint = crypto.createHash('sha256').update(src).digest('hex').slice(0, 12);

const clean = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
const body = clean(src);

const events = [...body.matchAll(/\bevent\s+(\w+)\s*\(([\s\S]*?)\)\s*;/g)]
  .map((m) => ({ name: m[1], params: m[2].replace(/\s+/g, ' ').trim() || '—' }))
  .sort((a, b) => a.name.localeCompare(b.name));

const errors = [...body.matchAll(/\berror\s+(\w+)\s*\(([^)]*)\)\s*;/g)]
  .map((m) => ({ name: m[1], args: m[2].replace(/\s+/g, ' ').trim() || '—' }))
  .sort((a, b) => a.name.localeCompare(b.name));

const eventUsage = {
  JobCreated: ['New escrow obligation opened', 'Track escrow growth and job throughput'],
  JobApplied: ['Agent assigned and bond locked', 'Detect assignment churn and anti-takeover posture'],
  JobCompletionRequested: ['Agent submitted completion metadata', 'Start completion review SLA timers'],
  JobValidated: ['Validator approval vote', 'Track validator participation and threshold trajectory'],
  JobDisapproved: ['Validator disapproval vote', 'Alert when disapproval velocity accelerates'],
  JobDisputed: ['Dispute lane entered', 'Page moderator operations queue'],
  DisputeResolvedWithCode: ['Moderator or owner resolved dispute', 'Audit resolution code distribution and reasons'],
  JobCompleted: ['Settlement in favor of agent', 'Reconcile payout and validator reward flows'],
  JobExpired: ['Job missed deadline and expired', 'Track employer protection triggers'],
  JobCancelled: ['Unassigned job cancelled', 'Confirm escrow release to employer'],
  SettlementPauseSet: ['Settlement lane pause toggled', 'Critical operations-state alert'],
  AGIWithdrawn: ['Owner treasury withdrawal', 'High-severity treasury-control alert'],
  IdentityConfigurationLocked: ['Identity wiring permanently locked', 'Governance milestone (one-way control)']
};

const errorUsage = {
  NotModerator: ['Unauthorized dispute-resolution call', 'Use approved moderator signer or owner stale-resolution lane'],
  NotAuthorized: ['Caller failed eligibility/role checks', 'Validate allowlists, proofs, ENS ownership, blacklist status'],
  Blacklisted: ['Caller is blocked by operator policy', 'Review blacklist rationale and incident policy'],
  InvalidParameters: ['Out-of-range config value or malformed input', 'Run scripts/ops/validate-params.js before submitting'],
  InvalidState: ['Function called in wrong lifecycle phase', 'Check job status flags and review/dispute windows'],
  JobNotFound: ['Unknown job id or deleted/cancelled struct', 'Verify event history and live jobId range'],
  TransferFailed: ['ERC20 transfer/transferFrom failed or malformed return', 'Confirm balance/allowance and exact-transfer token semantics'],
  SettlementPaused: ['Settlement lane currently paused', 'Follow incident runbook; unpause only after safety checks'],
  InsufficientWithdrawableBalance: ['Treasury withdrawal exceeds withdrawableAGI', 'Reconcile locked escrow/bonds before retry'],
  InsolventEscrowBalance: ['Escrow solvency guard tripped', 'Pause operations, investigate accounting divergence, run incident response']
};

const generatedAt = sourceFingerprint;

const content = `# Events and Errors Reference (Generated)\n\n- Generated at (deterministic source fingerprint): \`${generatedAt}\`.\n- Source: \`contracts/AGIJobManager.sol\`.\n\n## Events catalog\n\n| Event | Parameters | When emitted | Monitoring & alert guidance |\n| --- | --- | --- | --- |\n${events.map((e) => {
  const [when = 'Contract-defined emission point', note = 'Add event-specific monitors in SOC pipeline'] = eventUsage[e.name] ?? [];
  return `| \`${e.name}\` | \`${e.params}\` | ${when} | ${note} |`;
}).join('\n')}\n\n## Errors catalog\n\n| Error | Parameters | Likely causes | Remediation |\n| --- | --- | --- | --- |\n${errors.map((e) => {
  const [cause = 'Contract-defined guard violation', rem = 'Inspect transaction traces and state getters'] = errorUsage[e.name] ?? [];
  return `| \`${e.name}\` | ${e.args === '—' ? '—' : `\`${e.args}\``} | ${cause} | ${rem} |`;
}).join('\n')}\n\n## Source files used\n\n- \`contracts/AGIJobManager.sol\`\n`;

fs.mkdirSync(path.dirname(outFile), { recursive: true });
fs.writeFileSync(outFile, content);
console.log(`Generated ${path.relative(repoRoot, outFile)}`);
