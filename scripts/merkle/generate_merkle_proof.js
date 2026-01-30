const fs = require("fs");
const path = require("path");
const keccak256 = require("keccak256");
const { MerkleTree } = require("merkletreejs");

const args = process.argv.slice(2);
const options = {};
for (let i = 0; i < args.length; i += 1) {
  const arg = args[i];
  if (arg === "--input") {
    options.input = args[i + 1];
    i += 1;
  } else if (arg === "--address") {
    options.address = args[i + 1];
    i += 1;
  }
}

if (!options.input || !options.address) {
  console.error("Usage: node scripts/merkle/generate_merkle_proof.js --input <addresses.json> --address <0x...>");
  process.exit(1);
}

const inputPath = path.resolve(process.cwd(), options.input);
const raw = fs.readFileSync(inputPath, "utf8");
const addresses = JSON.parse(raw);

if (!Array.isArray(addresses) || addresses.length === 0) {
  console.error("Input JSON must be a non-empty array of addresses.");
  process.exit(1);
}

const normalizeAddress = (address) => {
  const lower = address.toLowerCase();
  if (!/^0x[0-9a-f]{40}$/.test(lower)) {
    throw new Error(`Invalid address: ${address}`);
  }
  return lower;
};

const toLeaf = (address) => {
  const normalized = normalizeAddress(address);
  const bytes = Buffer.from(normalized.slice(2), "hex");
  return keccak256(bytes);
};

const leaves = addresses.map(toLeaf);
const tree = new MerkleTree(leaves, keccak256, { sortPairs: true, sortLeaves: true });
const targetLeaf = toLeaf(options.address);

const leafIndex = leaves.findIndex((leaf) => leaf.equals(targetLeaf));
if (leafIndex === -1) {
  console.error("Target address is not in the input list.");
  process.exit(1);
}

const proof = tree.getHexProof(targetLeaf);
const output = {
  root: tree.getHexRoot(),
  leaf: `0x${targetLeaf.toString("hex")}`,
  proof,
};

console.log(JSON.stringify(output, null, 2));
