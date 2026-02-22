#!/usr/bin/env node
import fs from "fs";
import path from "path";
import Web3 from "web3";

const DEFAULT_IMAGE = "ipfs://Qmc13BByj8xKnpgQtwBereGJpEXtosLMLq6BCUjK3TtAd1";

const AGI_JOB_MANAGER_ABI = [
  {
    name: "getJobCore",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "jobId", type: "uint256" }],
    outputs: [
      { name: "employer", type: "address" },
      { name: "assignedAgent", type: "address" },
      { name: "payout", type: "uint256" },
      { name: "duration", type: "uint256" },
      { name: "assignedAt", type: "uint256" },
      { name: "completed", type: "bool" },
      { name: "disputed", type: "bool" },
      { name: "expired", type: "bool" },
      { name: "agentPayoutPct", type: "uint8" }
    ]
  },
  {
    name: "getJobValidation",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "jobId", type: "uint256" }],
    outputs: [
      { name: "completionRequested", type: "bool" },
      { name: "validatorApprovals", type: "uint256" },
      { name: "validatorDisapprovals", type: "uint256" },
      { name: "completionRequestedAt", type: "uint256" },
      { name: "disputedAt", type: "uint256" }
    ]
  },
  { name: "getJobSpecURI", type: "function", stateMutability: "view", inputs: [{ name: "jobId", type: "uint256" }], outputs: [{ type: "string" }] },
  { name: "getJobCompletionURI", type: "function", stateMutability: "view", inputs: [{ name: "jobId", type: "uint256" }], outputs: [{ type: "string" }] }
];

function parseArgs(argv) {
  const out = { jobIds: [] };
  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--rpc") out.rpc = argv[++i];
    else if (arg === "--manager") out.manager = argv[++i];
    else if (arg === "--job-ids") out.jobIds = argv[++i].split(",").map((v) => v.trim()).filter(Boolean);
    else if (arg === "--out") out.outDir = argv[++i];
    else if (arg === "--image") out.image = argv[++i];
    else if (arg === "--external-url-base") out.externalUrlBase = argv[++i];
    else if (arg === "--help") out.help = true;
  }
  return out;
}

function usage() {
  console.log("Usage: node scripts/nft/generate-job-nft-metadata.mjs --rpc <url> --manager <address> --job-ids 1,2 --out <dir> [--image <uri>] [--external-url-base <base>]");
}

function asDateSecondsString(value) {
  return String(Number(value || 0));
}

async function main() {
  const args = parseArgs(process.argv);
  if (args.help || !args.rpc || !args.manager || !args.outDir || args.jobIds.length === 0) {
    usage();
    process.exit(args.help ? 0 : 1);
  }

  fs.mkdirSync(args.outDir, { recursive: true });

  const web3 = new Web3(args.rpc);
  const chainId = await web3.eth.getChainId();
  const manager = new web3.eth.Contract(AGI_JOB_MANAGER_ABI, args.manager);
  const image = args.image || DEFAULT_IMAGE;

  for (const rawJobId of args.jobIds) {
    const jobId = String(rawJobId);
    const core = await manager.methods.getJobCore(jobId).call();
    const validation = await manager.methods.getJobValidation(jobId).call();
    const jobSpecURI = await manager.methods.getJobSpecURI(jobId).call();
    const jobCompletionURI = await manager.methods.getJobCompletionURI(jobId).call();

    const externalUrl = args.externalUrlBase ? `${args.externalUrlBase.replace(/\/$/, "")}/${jobId}` : "";

    const metadata = {
      name: `AGI Job Completion #${jobId}`,
      description: `Completion NFT for AGIJobManager job ${jobId}. This protocol is intended for autonomous AI agents exclusively; humans act as owners/operators/supervisors.`,
      image,
      image_url: image,
      external_url: externalUrl,
      attributes: [
        { trait_type: "jobId", value: jobId },
        { trait_type: "chainId", value: String(chainId) },
        { trait_type: "contractAddress", value: args.manager },
        { trait_type: "employer", value: core.employer },
        { trait_type: "assignedAgent", value: core.assignedAgent },
        { trait_type: "payout", value: String(core.payout) },
        { trait_type: "assignedAt", display_type: "date", value: asDateSecondsString(core.assignedAt) },
        {
          trait_type: "completionRequestedAt",
          display_type: "date",
          value: asDateSecondsString(validation.completionRequestedAt)
        },
        { trait_type: "jobSpecURI", value: jobSpecURI },
        { trait_type: "jobCompletionURI", value: jobCompletionURI }
      ]
    };

    const outPath = path.join(args.outDir, `${jobId}.json`);
    fs.writeFileSync(outPath, `${JSON.stringify(metadata, null, 2)}\n`);

    console.log(`[metadata] jobId=${jobId} path=${outPath}`);
    console.log(`[suggested-token-uri] ipfs://<CID>/${jobId}.json`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
