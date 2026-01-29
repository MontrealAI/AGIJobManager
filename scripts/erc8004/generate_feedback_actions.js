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

function listJsonFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter((file) => file.endsWith('.json'))
    .map((file) => path.join(dir, file));
}

function buildActionsFromFeedback(feedbackFile, registryAddress, chainId) {
  const data = readJson(feedbackFile);
  const { agentRegistry, agentId, feedback } = data;
  if (!Array.isArray(feedback)) return [];

  return feedback.map((entry) => ({
    contractAddress: registryAddress || null,
    functionName: null,
    args: {
      agentRegistry,
      agentId,
      feedback: entry,
    },
    calldata: null,
    chainId,
    summary: `Feedback ${entry.tag1} for agentId ${agentId}`,
  }));
}

function buildActionsFromMetrics(metrics) {
  const signals = [];

  if (metrics.rates?.successRate) {
    signals.push({
      tag1: 'successRate',
      tag2: null,
      value: metrics.rates.successRate.value,
      valueDecimals: metrics.rates.successRate.valueDecimals,
    });
  }

  if (metrics.rates?.disputeRate) {
    signals.push({
      tag1: 'disputeRate',
      tag2: null,
      value: metrics.rates.disputeRate.value,
      valueDecimals: metrics.rates.disputeRate.valueDecimals,
    });
  }

  if (metrics.revenuesProxy) {
    signals.push({
      tag1: 'revenues',
      tag2: null,
      value: metrics.revenuesProxy,
      valueDecimals: 0,
      note: 'Proxy: sum of job payout values for completed jobs (raw token units).',
    });
  }

  return signals.sort(sortByTag);
}

function main() {
  const metricsPath = process.env.METRICS_JSON || getArgValue('metrics-json');
  const feedbackDir = process.env.FEEDBACK_DIR || getArgValue('feedback-dir');
  const outDir = process.env.OUT_DIR || getArgValue('out-dir') || (metricsPath ? path.dirname(metricsPath) : process.cwd());
  const registryAddress = process.env.ERC8004_REPUTATION_REGISTRY || getArgValue('registry');
  const chainId = process.env.CHAIN_ID ? Number(process.env.CHAIN_ID) : null;

  let actions = [];
  let source = {};

  if (metricsPath) {
    const metrics = readJson(metricsPath);
    const agents = metrics.agents || {};
    const addresses = Object.keys(agents).sort();
    actions = addresses.flatMap((address) => {
      const signals = buildActionsFromMetrics(agents[address]);
      return signals.map((signal) => ({
        contractAddress: registryAddress || null,
        functionName: null,
        args: {
          subjectAddress: address,
          signal,
        },
        calldata: null,
        chainId,
        summary: `Feedback ${signal.tag1} for wallet ${address}`,
        note: signal.note || null,
      }));
    });
    source = metrics.metadata || {};
  } else if (feedbackDir) {
    const files = listJsonFiles(feedbackDir);
    actions = files.flatMap((file) => buildActionsFromFeedback(file, registryAddress, chainId));
    source = { feedbackDir };
  } else {
    throw new Error('Missing METRICS_JSON/--metrics-json or FEEDBACK_DIR/--feedback-dir');
  }

  const output = {
    source,
    generatedAt: new Date().toISOString(),
    actions,
    notes: 'Dry-run output only. Provide registry ABI + function name from 8004.org/build for submission.',
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
