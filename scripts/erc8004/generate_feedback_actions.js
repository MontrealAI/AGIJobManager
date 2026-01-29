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

function listFeedbackFiles(dir) {
  return fs.readdirSync(dir)
    .filter((file) => file.endsWith('.json'))
    .filter((file) => file.startsWith('agent_') || file.startsWith('validator_'))
    .filter((file) => !file.endsWith('.wallet.json'))
    .map((file) => path.join(dir, file));
}

function main() {
  const feedbackDir = process.env.FEEDBACK_DIR || getArgValue('feedback-dir');
  const summaryPath = process.env.SUMMARY_JSON || getArgValue('summary-json');
  const reputationRegistry = process.env.ERC8004_REPUTATION_REGISTRY || getArgValue('reputation-registry');
  const sendTx = String(process.env.SEND_TX || getArgValue('send-tx') || 'false').toLowerCase() === 'true';

  if (!feedbackDir) {
    throw new Error('Missing FEEDBACK_DIR or --feedback-dir (directory containing reputation-v1 files).');
  }
  if (sendTx) {
    throw new Error('SEND_TX is not supported in this repo. Use official ERC-8004 tooling from 8004.org/build with the exported JSON payloads.');
  }

  const outDir = process.env.OUT_DIR || getArgValue('out-dir') || feedbackDir;
  const feedbackFiles = listFeedbackFiles(feedbackDir);

  if (!feedbackFiles.length) {
    throw new Error('No reputation-v1 files found in FEEDBACK_DIR.');
  }

  const summary = summaryPath && fs.existsSync(summaryPath) ? readJson(summaryPath) : null;

  const actions = feedbackFiles.map((filePath) => {
    const payload = readJson(filePath);
    const filename = path.basename(filePath);
    const feedbackCount = Array.isArray(payload.feedback) ? payload.feedback.length : 0;

    return {
      contractAddress: reputationRegistry || null,
      functionName: null,
      args: null,
      calldata: null,
      chainId: summary?.metadata?.chainId || null,
      humanSummary: `Prepare ERC-8004 feedback submission for agentId ${payload.agentId} (${feedbackCount} entries).`,
      feedbackFile: filename,
      payload,
    };
  });

  const output = {
    source: summary?.metadata || null,
    generatedAt: new Date().toISOString(),
    dryRun: true,
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
