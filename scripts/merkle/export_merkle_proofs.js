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
  } else if (arg === "--output") {
    options.output = args[i + 1];
    i += 1;
  }
}

if (!options.input) {
  console.error("Usage: node scripts/merkle/export_merkle_proofs.js --input <addresses.json> [--output proofs.json]");
  process.exit(1);
}

const inputPath = path.resolve(process.cwd(), options.input);
const outputPath = options.output ? path.resolve(process.cwd(), options.output) : null;

const normalizeAddress = (address) => {
  const lower = String(address).toLowerCase();
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

const raw = fs.readFileSync(inputPath, "utf8");
const parsed = JSON.parse(raw);
if (!Array.isArray(parsed) || parsed.length === 0) {
  console.error("Input JSON must be a non-empty array of addresses.");
  process.exit(1);
}

const addresses = [...new Set(parsed.map(normalizeAddress))].sort();
const leaves = addresses.map(toLeaf);
const tree = new MerkleTree(leaves, keccak256, { sortPairs: true, sortLeaves: true });

const proofs = {};
for (const address of addresses) {
  proofs[address] = tree.getHexProof(toLeaf(address));
}

const output = {
  leafEncoding: "keccak256(abi.encodePacked(address))",
  merkleOptions: { sortPairs: true, sortLeaves: true },
  root: tree.getHexRoot(),
  proofs,
  etherscanProofs: Object.fromEntries(
    Object.entries(proofs).map(([addr, proof]) => [addr, JSON.stringify(proof)])
  )
};

if (outputPath) {
  fs.writeFileSync(outputPath, JSON.stringify(output, null, 2) + "\n", "utf8");
  console.log(`Wrote ${outputPath}`);
} else {
  console.log(JSON.stringify(output, null, 2));
}
