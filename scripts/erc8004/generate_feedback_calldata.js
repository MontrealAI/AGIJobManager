const fs = require('fs');
const path = require('path');

function getArgValue(name) {
  const withEquals = process.argv.find((arg) => arg.startsWith(`--${name}=`));
  if (withEquals) return withEquals.split('=')[1];
  const index = process.argv.findIndex((arg) => arg === `--${name}`);
  if (index !== -1 && process.argv[index + 1]) return process.argv[index + 1];
  return undefined;
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function loadJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function buildActions(metrics) {
  const actions = [];
  const agents = metrics.agents || {};

  for (const [address, stats] of Object.entries(agents)) {
    actions.push({
      subject: address,
      tag: 'jobsCompleted',
      value: stats.jobsCompleted,
      valueDecimals: 0,
      evidence: '',
    });
    actions.push({
      subject: address,
      tag: 'jobsDisputed',
      value: stats.jobsDisputed,
      valueDecimals: 0,
      evidence: '',
    });
    actions.push({
      subject: address,
      tag: 'successRate',
      value: stats.successRate.value,
      valueDecimals: stats.successRate.valueDecimals,
      evidence: '',
    });
    actions.push({
      subject: address,
      tag: 'disputeRate',
      value: stats.disputeRate.value,
      valueDecimals: stats.disputeRate.valueDecimals,
      evidence: '',
    });
    actions.push({
      subject: address,
      tag: 'revenues',
      value: stats.revenues.value,
      valueDecimals: stats.revenues.valueDecimals,
      evidence: '',
    });
  }

  return actions;
}

const metricsFile = process.env.METRICS_FILE || getArgValue('METRICS_FILE');
if (!metricsFile) {
  console.error('Missing METRICS_FILE');
  process.exit(1);
}

const outDir = process.env.OUT_DIR || getArgValue('OUT_DIR') || path.join('integrations', 'erc8004', 'out');
ensureDir(outDir);

const metrics = loadJson(metricsFile);
const actions = buildActions(metrics);

const fileName = `erc8004_feedback_actions_${Date.now()}.json`;
const filePath = path.join(outDir, fileName);
fs.writeFileSync(filePath, JSON.stringify({
  metadata: {
    source: metricsFile,
    generatedAt: new Date().toISOString(),
    chainId: metrics.metadata ? metrics.metadata.chainId : undefined,
  },
  actions,
}, null, 2));

console.log(`Feedback actions written to ${filePath}`);
