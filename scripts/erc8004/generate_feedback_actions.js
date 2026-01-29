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

function sortByTag(a, b) {
  return a.tag1.localeCompare(b.tag1);
}

function buildSignals(metrics) {
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

  return signals.sort(sortByTag);
}

function buildFeedbackActions(address, metrics) {
  const signals = buildSignals(metrics);
  const evidenceAnchors = metrics.evidence?.anchors || [];

  return signals.map((signal) => ({
    subject: {
      address,
      ens: metrics.ens || null,
    },
    tag1: signal.tag1,
    value: signal.value,
    valueDecimals: signal.valueDecimals,
    evidence: {
      anchors: evidenceAnchors,
      feedbackURI: null,
      feedbackHash: null,
    },
    notes: {
      tagNote: signal.note || null,
      jobsAssigned: metrics.jobsAssigned,
      jobsCompleted: metrics.jobsCompleted,
      jobsDisputed: metrics.jobsDisputed,
    },
  }));
}

function main() {
  const metricsPath = process.env.METRICS_JSON || getArgValue('metrics-json');
  if (!metricsPath) {
    throw new Error('Missing METRICS_JSON or --metrics-json');
  }

  const outDir = process.env.OUT_DIR || getArgValue('out-dir') || path.dirname(metricsPath);
  const metrics = readJson(metricsPath);
  const agents = metrics.agents || {};

  const addresses = Object.keys(agents).sort();
  const actions = addresses.flatMap((address) => buildFeedbackActions(address, agents[address]));

  const output = {
    source: metrics.metadata || {},
    generatedAt: new Date().toISOString(),
    actions,
    notes: 'Dry-run output only. Use official ERC-8004 tooling for on-chain submission.',
  };

  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, 'erc8004_feedback_actions.json');
  fs.writeFileSync(outPath, JSON.stringify(output, null, 2));
  console.log(`Feedback actions written to ${outPath}`);
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(error.message || error);
    process.exit(1);
  }
}
