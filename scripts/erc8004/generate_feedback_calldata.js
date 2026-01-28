/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');

function getArgValue(name) {
  const idx = process.argv.indexOf(`--${name}`);
  if (idx === -1) return null;
  return process.argv[idx + 1] || null;
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function buildFeedbackEntry(address, metrics) {
  const signals = [];

  if (metrics.rates?.successRate) {
    signals.push({
      tag1: 'successRate',
      value: metrics.rates.successRate.value,
      valueDecimals: metrics.rates.successRate.valueDecimals,
    });
  }

  if (metrics.rates?.disputeRate) {
    signals.push({
      tag1: 'disputeRate',
      value: metrics.rates.disputeRate.value,
      valueDecimals: metrics.rates.disputeRate.valueDecimals,
    });
  }

  if (metrics.revenuesProxy) {
    signals.push({
      tag1: 'revenues',
      value: metrics.revenuesProxy,
      valueDecimals: 0,
      note: 'Proxy: sum of job payout values for completed jobs (raw token units).',
    });
  }

  return {
    subject: address,
    signals,
    evidence: 'TODO: add evidence hash or IPFS CID',
    notes: {
      jobsApplied: metrics.jobsApplied,
      jobsAssigned: metrics.jobsAssigned,
      jobsCompleted: metrics.jobsCompleted,
      jobsDisputed: metrics.jobsDisputed,
      employerWins: metrics.employerWins,
      agentWins: metrics.agentWins,
      unknownResolutions: metrics.unknownResolutions,
    },
  };
}

function main() {
  const metricsPath = process.env.METRICS_JSON || getArgValue('metrics-json');
  if (!metricsPath) {
    throw new Error('Missing METRICS_JSON or --metrics-json');
  }

  const outDir = process.env.OUT_DIR || getArgValue('out-dir') || path.dirname(metricsPath);
  const metrics = readJson(metricsPath);

  const entries = Object.entries(metrics.agents || {}).map(([address, data]) => buildFeedbackEntry(address, data));

  const output = {
    source: metrics.metadata || {},
    generatedAt: new Date().toISOString(),
    feedback: entries,
    notes: 'Dry-run output only. Use official ERC-8004 tooling (e.g., Agent0 SDK) for on-chain submission.',
  };

  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, 'erc8004_feedback_intents.json');
  fs.writeFileSync(outPath, JSON.stringify(output, null, 2));
  console.log(`Feedback intents written to ${outPath}`);
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(error.message || error);
    process.exit(1);
  }
}
