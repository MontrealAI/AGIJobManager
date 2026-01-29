/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');

function ensureWeb3() {
  if (typeof web3 !== 'undefined') return web3;
  const Web3 = require('web3');
  const providerUrl = process.env.WEB3_PROVIDER || 'http://127.0.0.1:8545';
  const web3Instance = new Web3(providerUrl);
  global.web3 = web3Instance;
  return web3Instance;
}

function getArgValue(name) {
  const idx = process.argv.indexOf(`--${name}`);
  if (idx === -1) return null;
  return process.argv[idx + 1] || null;
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function listJsonFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter((file) => file.endsWith('.json'))
    .map((file) => path.join(dir, file));
}

function normalizeAddress(address) {
  return address ? address.toLowerCase() : address;
}

function parseAgentRegistry(agentRegistry) {
  const [namespace, chainId, identityRegistry] = String(agentRegistry || '').split(':');
  return { namespace, chainId: Number(chainId), identityRegistry };
}

function getAbi(fileName) {
  const abiPath = path.join(__dirname, `../../integrations/erc8004/abis/${fileName}`);
  return readJson(abiPath);
}

function getFunctionAbi(abi, name) {
  return abi.find((item) => item.type === 'function' && item.name === name);
}

async function checkSenderEligibility({ identityRegistryAddress, agentId, sender }) {
  const identityAbi = getAbi('IdentityRegistry.json');
  const identityRegistry = new web3.eth.Contract(identityAbi, identityRegistryAddress);
  const owner = await identityRegistry.methods.ownerOf(agentId).call();
  if (normalizeAddress(owner) === normalizeAddress(sender)) {
    throw new Error(`Sender ${sender} is the owner of agentId ${agentId}.`);
  }
  const approved = await identityRegistry.methods.getApproved(agentId).call();
  if (normalizeAddress(approved) === normalizeAddress(sender)) {
    throw new Error(`Sender ${sender} is the approved operator for agentId ${agentId}.`);
  }
  const isApprovedForAll = await identityRegistry.methods.isApprovedForAll(owner, sender).call();
  if (isApprovedForAll) {
    throw new Error(`Sender ${sender} is an approved operator for agentId ${agentId}.`);
  }
}

function validateValueDecimals(valueDecimals) {
  if (!Number.isInteger(valueDecimals) || valueDecimals < 0 || valueDecimals > 18) {
    throw new Error(`valueDecimals must be an integer in [0,18]. Got: ${valueDecimals}`);
  }
}

async function main() {
  ensureWeb3();
  const feedbackDir = process.env.FEEDBACK_DIR || getArgValue('feedback-dir');
  if (!feedbackDir) {
    throw new Error('Missing FEEDBACK_DIR/--feedback-dir');
  }

  const outDir = process.env.OUT_DIR || getArgValue('out-dir') || path.join(process.cwd(), 'integrations/erc8004/out');
  const sendTx = String(process.env.SEND_TX || '').toLowerCase() === 'true';
  const dryRunEnv = process.env.DRY_RUN;
  const dryRun = dryRunEnv === undefined || dryRunEnv === null
    ? !sendTx
    : String(dryRunEnv).toLowerCase() !== 'false';
  const confirm = String(process.env.I_UNDERSTAND || '').toLowerCase() === 'true';

  const reputationRegistryAddress = process.env.ERC8004_REPUTATION_REGISTRY || getArgValue('reputation-registry');
  if (!reputationRegistryAddress) {
    throw new Error('Missing ERC8004_REPUTATION_REGISTRY.');
  }

  const reputationAbi = getAbi('ReputationRegistry.json');
  const giveFeedbackAbi = getFunctionAbi(reputationAbi, 'giveFeedback');
  if (!giveFeedbackAbi) {
    throw new Error('giveFeedback ABI not found; ensure official ReputationRegistry ABI is present.');
  }

  const feedbackFiles = listJsonFiles(feedbackDir);
  const actions = [];

  for (const filePath of feedbackFiles.sort()) {
    const entry = readJson(filePath);
    const { agentRegistry, agentId, value, valueDecimals } = entry;
    if (!agentRegistry || agentId === undefined || agentId === null) {
      throw new Error(`Missing agentRegistry/agentId in ${filePath}.`);
    }
    validateValueDecimals(Number(valueDecimals));

    const { identityRegistry, chainId } = parseAgentRegistry(agentRegistry);
    const args = [
      agentId,
      value,
      valueDecimals,
      entry.tag1 || '',
      entry.tag2 || '',
      entry.endpoint || '',
      entry.feedbackURI || '',
      entry.feedbackHash || '0x' + '00'.repeat(32),
    ];

    const calldata = web3.eth.abi.encodeFunctionCall(giveFeedbackAbi, args);
    actions.push({
      to: reputationRegistryAddress,
      function: 'giveFeedback',
      args: {
        agentId,
        value,
        valueDecimals,
        tag1: entry.tag1 || '',
        tag2: entry.tag2 || '',
        endpoint: entry.endpoint || '',
        feedbackURI: entry.feedbackURI || '',
        feedbackHash: entry.feedbackHash || '0x' + '00'.repeat(32),
      },
      calldata,
      humanSummary: `giveFeedback(${agentId}, ${entry.tag1 || ''}) from ${path.basename(filePath)}`,
      chainId,
      identityRegistry,
    });
  }

  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, 'erc8004_submit_actions.json');
  fs.writeFileSync(outPath, JSON.stringify(actions, null, 2));
  console.log(`Submit actions written to ${outPath}`);

  if (!sendTx || dryRun) {
    const reason = !sendTx
      ? 'SEND_TX is false'
      : 'DRY_RUN is true';
    console.log(`DRY-RUN only (no transactions sent): ${reason}.`);
    return;
  }
  if (!confirm) {
    throw new Error('SEND_TX=true requires I_UNDERSTAND=true confirmation.');
  }

  const accounts = await web3.eth.getAccounts();
  const sender = process.env.SENDER || getArgValue('sender') || accounts[0];
  if (!sender) {
    throw new Error('Unable to resolve sender account for SEND_TX.');
  }

  const reputationRegistry = new web3.eth.Contract(reputationAbi, reputationRegistryAddress);
  for (const action of actions) {
    await checkSenderEligibility({
      identityRegistryAddress: action.identityRegistry,
      agentId: action.args.agentId,
      sender,
    });
    // eslint-disable-next-line no-await-in-loop
    await reputationRegistry.methods.giveFeedback(
      action.args.agentId,
      action.args.value,
      action.args.valueDecimals,
      action.args.tag1,
      action.args.tag2,
      action.args.endpoint,
      action.args.feedbackURI,
      action.args.feedbackHash,
    ).send({ from: sender });
  }

  console.log(`Submitted ${actions.length} feedback transactions.`);
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error.message || error);
    process.exit(1);
  });
}
