/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');
const { Contract, Interface, getAddress } = require('ethers');
const { providerFor, assertNetwork } = require('../lib/operations');

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
  if (namespace !== 'eip155' || !/^\d+$/.test(chainId || '') || !Number.isSafeInteger(Number(chainId)) || Number(chainId) < 1) {
    throw new Error(`Invalid EIP-155 agentRegistry: ${agentRegistry}`);
  }
  return { namespace, chainId: Number(chainId), identityRegistry: getAddress(identityRegistry) };
}

function getAbi(fileName) {
  const abiPath = path.join(__dirname, `../../integrations/erc8004/abis/${fileName}`);
  return readJson(abiPath);
}

function getFunctionAbi(abi, name) {
  return abi.find((item) => item.type === 'function' && item.name === name);
}

async function checkSenderEligibility({ identityRegistryAddress, agentId, sender, provider }) {
  const identityAbi = getAbi('IdentityRegistry.json');
  const identityRegistry = new Contract(identityRegistryAddress, identityAbi, provider);
  const owner = await identityRegistry.ownerOf(agentId);
  if (normalizeAddress(owner) === normalizeAddress(sender)) {
    throw new Error(`Sender ${sender} is the owner of agentId ${agentId}.`);
  }
  const approved = await identityRegistry.getApproved(agentId);
  if (normalizeAddress(approved) === normalizeAddress(sender)) {
    throw new Error(`Sender ${sender} is the approved operator for agentId ${agentId}.`);
  }
  const isApprovedForAll = await identityRegistry.isApprovedForAll(owner, sender);
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
  const feedbackDir = process.env.FEEDBACK_DIR || getArgValue('feedback-dir');
  if (!feedbackDir) {
    throw new Error('Missing FEEDBACK_DIR/--feedback-dir');
  }

  const outDir = process.env.OUT_DIR || getArgValue('out-dir') || path.join(process.cwd(), 'integrations/erc8004/out');
  const sendTx = String(process.env.SEND_TX || '').toLowerCase() === 'true';
  const dryRunRaw = process.env.DRY_RUN;
  const dryRun = dryRunRaw === undefined || dryRunRaw === ''
    ? !sendTx
    : String(dryRunRaw).toLowerCase() !== 'false';
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

    const calldata = new Interface(reputationAbi).encodeFunctionData('giveFeedback', args);
    actions.push({
      to: getAddress(reputationRegistryAddress),
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
    if (sendTx && dryRun) {
      throw new Error('SEND_TX=true requested but DRY_RUN=true; set DRY_RUN=false to send transactions.');
    }
    console.log('DRY-RUN only (no transactions sent).');
    return;
  }
  if (!confirm) {
    throw new Error('SEND_TX=true requires I_UNDERSTAND=true confirmation.');
  }

  const network = getArgValue('network') || 'development';
  const provider = providerFor(network);
  try {
    const chainId = Number(await assertNetwork(provider, network));
    for (const action of actions) {
      if (action.chainId !== chainId) throw new Error(`Feedback chain ${action.chainId} does not match connected chain ${chainId}.`);
    }
    const senderInput = process.env.SENDER || getArgValue('sender');
    if (!senderInput && ![1337, 31337].includes(chainId)) {
      throw new Error('Public-chain submission requires an explicit SENDER/--sender and an unlocked signing RPC.');
    }
    const signer = await provider.getSigner(senderInput || 0);
    const sender = await signer.getAddress();
    if (await provider.getCode(reputationRegistryAddress) === '0x') throw new Error('No reputation registry contract code.');
    // Check every action before the first broadcast, then recheck eligibility per send.
    for (const action of actions) {
      await checkSenderEligibility({ identityRegistryAddress: action.identityRegistry, agentId: action.args.agentId, sender, provider });
    }
    const reputationRegistry = new Contract(reputationRegistryAddress, reputationAbi, signer);
    for (const action of actions) {
      await checkSenderEligibility({ identityRegistryAddress: action.identityRegistry, agentId: action.args.agentId, sender, provider });
      const transaction = await reputationRegistry.giveFeedback(
        action.args.agentId, action.args.value, action.args.valueDecimals,
        action.args.tag1, action.args.tag2, action.args.endpoint,
        action.args.feedbackURI, action.args.feedbackHash,
      );
      const receipt = await transaction.wait();
      if (!receipt || receipt.status !== 1) throw new Error(`Feedback transaction failed: ${transaction.hash}`);
    }
  } finally {
    provider.destroy();
  }

  console.log(`Submitted ${actions.length} feedback transactions.`);
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error.message || error);
    process.exit(1);
  });
}
