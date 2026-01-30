#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");
const { MerkleTree } = require("merkletreejs");
const keccak256 = require("keccak256");

function parseArgs(argv) {
  const args = { list: null, address: null, out: null, verify: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--list") {
      args.list = argv[i + 1];
      i += 1;
    } else if (arg === "--address") {
      args.address = argv[i + 1];
      i += 1;
    } else if (arg === "--out") {
      args.out = argv[i + 1];
      i += 1;
    } else if (arg === "--verify") {
      args.verify = true;
    }
  }
  return args;
}

function normalizeAddress(address) {
  if (typeof address !== "string") {
    throw new Error("Address must be a string.");
  }
  const trimmed = address.trim().toLowerCase();
  if (!/^0x[a-f0-9]{40}$/.test(trimmed)) {
    throw new Error(`Invalid address: ${address}`);
  }
  return trimmed;
}

function toLeaf(address) {
  return keccak256(Buffer.from(address.slice(2), "hex"));
}

function loadAddressList(filePath) {
  const raw = fs.readFileSync(filePath, "utf8");
  const data = JSON.parse(raw);
  if (!Array.isArray(data)) {
    throw new Error("Address list JSON must be an array.");
  }
  return data.map(normalizeAddress);
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.list || !args.address) {
    const usage = [
      "Usage:",
      "  node scripts/merkle/generate-proof.js --list path/to/addresses.json --address 0x... [--out output.json] [--verify]",
    ].join("\n");
    console.error(usage);
    process.exit(1);
  }

  const listPath = path.resolve(process.cwd(), args.list);
  const target = normalizeAddress(args.address);
  const addresses = loadAddressList(listPath);

  const leaves = addresses.map(toLeaf);
  const tree = new MerkleTree(leaves, keccak256, { sortPairs: true });
  const leaf = toLeaf(target);
  const proof = tree.getHexProof(leaf);
  const root = tree.getHexRoot();

  const output = {
    root,
    address: target,
    leaf: `0x${leaf.toString("hex")}`,
    proof,
    verified: tree.verify(proof, leaf, root),
  };

  if (args.verify && !output.verified) {
    console.error("Proof verification failed. Ensure the address is in the list.");
    process.exit(1);
  }

  const serialized = JSON.stringify(output, null, 2);
  if (args.out) {
    const outPath = path.resolve(process.cwd(), args.out);
    fs.writeFileSync(outPath, serialized);
  } else {
    console.log(serialized);
  }
}

main();
