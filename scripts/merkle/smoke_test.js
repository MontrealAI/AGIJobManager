const path = require("path");
const keccak256 = require("keccak256");
const { MerkleTree } = require("merkletreejs");

const addresses = require(path.join(__dirname, "sample_addresses.json"));

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
const root = tree.getHexRoot();

const target = addresses[0];
const leaf = toLeaf(target);
const proof = tree.getHexProof(leaf);
const verified = tree.verify(proof, leaf, root);

if (!verified) {
  throw new Error("Merkle proof verification failed in smoke test.");
}

console.log("Merkle smoke test passed.");
