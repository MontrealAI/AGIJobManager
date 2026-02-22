#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import Web3 from "web3";

const DEFAULT_IMAGE_IPFS = "ipfs://Qmc13BByj8xKnpgQtwBereGJpEXtosLMLq6BCUjK3TtAd1";
const DEFAULT_IMAGE_GATEWAY = "https://ipfs.io/ipfs/Qmc13BByj8xKnpgQtwBereGJpEXtosLMLq6BCUjK3TtAd1";

function parseArgs(argv) {
  const out = {};
  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith("--")) continue;
    const key = arg.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith("--")) {
      out[key] = "true";
      continue;
    }
    out[key] = next;
    i += 1;
  }
  return out;
}

function normalizeJobIds(value) {
  return value
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => {
      if (!/^\d+$/.test(s)) {
        throw new Error(`Invalid jobId: ${s}`);
      }
      return BigInt(s).toString();
    });
}

function stableMetadata({ jobId, chainId, managerAddress, employer, assignedAgent, payout, assignedAt, completionRequestedAt, jobSpecURI, jobCompletionURI, imageURI, externalUrl }) {
  return {
    name: `AGI Job Completion #${jobId}`,
    description:
      `Completion credential NFT for AGIJobManager job ${jobId}. This protocol is intended for autonomous AI agents exclusively; humans act as owners, operators, or supervisors.`,
    image: imageURI,
    image_url: imageURI === DEFAULT_IMAGE_IPFS ? DEFAULT_IMAGE_GATEWAY : imageURI,
    external_url: externalUrl,
    attributes: [
      { trait_type: "jobId", value: String(jobId) },
      { trait_type: "chainId", value: String(chainId) },
      { trait_type: "contractAddress", value: managerAddress },
      { trait_type: "employer", value: employer },
      { trait_type: "assignedAgent", value: assignedAgent },
      { trait_type: "payout", value: String(payout) },
      { trait_type: "assignedAt", value: String(assignedAt) },
      { trait_type: "completionRequestedAt", value: String(completionRequestedAt) },
      { trait_type: "jobSpecURI", value: jobSpecURI },
      { trait_type: "jobCompletionURI", value: jobCompletionURI },
    ],
  };
}

const args = parseArgs(process.argv);
const rpcUrl = args.rpc || process.env.RPC_URL;
const managerAddress = args.manager;
let jobIds = [];
try {
  jobIds = normalizeJobIds(args.jobs || "");
} catch (err) {
  console.error(err.message);
  process.exit(1);
}
const outDir = args.out || "./artifacts/job-nft-metadata";
const imageURI = args.image || DEFAULT_IMAGE_IPFS;
const externalUrlBase = args["external-url-base"] || "";

if (!rpcUrl || !managerAddress || jobIds.length === 0) {
  console.error("Usage: node scripts/nft/generate-job-nft-metadata.mjs --rpc <url> --manager <address> --jobs 1,2 --out <dir>");
  process.exit(1);
}

const web3 = new Web3(rpcUrl);
const abi = [
  { "inputs": [{ "internalType": "uint256", "name": "jobId", "type": "uint256" }], "name": "getJobCore", "outputs": [
    { "internalType": "address", "name": "employer", "type": "address" },
    { "internalType": "address", "name": "assignedAgent", "type": "address" },
    { "internalType": "uint256", "name": "payout", "type": "uint256" },
    { "internalType": "uint256", "name": "duration", "type": "uint256" },
    { "internalType": "uint256", "name": "assignedAt", "type": "uint256" },
    { "internalType": "bool", "name": "completed", "type": "bool" },
    { "internalType": "bool", "name": "disputed", "type": "bool" },
    { "internalType": "bool", "name": "expired", "type": "bool" },
    { "internalType": "uint8", "name": "agentPayoutPct", "type": "uint8" }
  ], "stateMutability": "view", "type": "function" },
  { "inputs": [{ "internalType": "uint256", "name": "jobId", "type": "uint256" }], "name": "getJobValidation", "outputs": [
    { "internalType": "bool", "name": "completionRequested", "type": "bool" },
    { "internalType": "uint256", "name": "validatorApprovals", "type": "uint256" },
    { "internalType": "uint256", "name": "validatorDisapprovals", "type": "uint256" },
    { "internalType": "uint256", "name": "completionRequestedAt", "type": "uint256" },
    { "internalType": "uint256", "name": "disputedAt", "type": "uint256" }
  ], "stateMutability": "view", "type": "function" },
  { "inputs": [{ "internalType": "uint256", "name": "jobId", "type": "uint256" }], "name": "getJobSpecURI", "outputs": [{ "internalType": "string", "name": "", "type": "string" }], "stateMutability": "view", "type": "function" },
  { "inputs": [{ "internalType": "uint256", "name": "jobId", "type": "uint256" }], "name": "getJobCompletionURI", "outputs": [{ "internalType": "string", "name": "", "type": "string" }], "stateMutability": "view", "type": "function" },
];

const manager = new web3.eth.Contract(abi, managerAddress);
const chainId = await web3.eth.getChainId();
fs.mkdirSync(outDir, { recursive: true });

for (const jobId of jobIds) {
  const core = await manager.methods.getJobCore(jobId).call();
  const validation = await manager.methods.getJobValidation(jobId).call();
  const jobSpecURI = await manager.methods.getJobSpecURI(jobId).call();
  const jobCompletionURI = await manager.methods.getJobCompletionURI(jobId).call();
  const externalUrl = externalUrlBase ? `${externalUrlBase.replace(/\/$/, "")}/${jobId}` : "";

  const metadata = stableMetadata({
    jobId,
    chainId,
    managerAddress,
    employer: core.employer,
    assignedAgent: core.assignedAgent,
    payout: core.payout,
    assignedAt: core.assignedAt,
    completionRequestedAt: validation.completionRequestedAt,
    jobSpecURI,
    jobCompletionURI,
    imageURI,
    externalUrl,
  });

  const outPath = path.join(outDir, `${jobId}.json`);
  fs.writeFileSync(outPath, `${JSON.stringify(metadata, null, 2)}\n`);
  console.log(`Wrote ${outPath}`);
  console.log(`Suggested tokenURI: ipfs://<CID>/${jobId}.json`);
}
