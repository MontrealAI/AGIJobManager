#!/usr/bin/env node
/* eslint-disable no-console */

const fs = require('fs');
const path = require('path');
const abi = require('web3-eth-abi');

function parseArg(flag) {
  const idx = process.argv.indexOf(flag);
  if (idx === -1 || idx + 1 >= process.argv.length) return null;
  return process.argv[idx + 1];
}

function main() {
  const receiptPath = parseArg('--receipt');
  if (!receiptPath) {
    throw new Error('Usage: node scripts/ops/encode_constructor_args.js --receipt <deployments/...json>');
  }

  const abs = path.resolve(process.cwd(), receiptPath);
  const receipt = JSON.parse(fs.readFileSync(abs, 'utf8'));
  const args = receipt.constructorArgs;
  if (!args) {
    throw new Error('Receipt missing constructorArgs');
  }

  const encoded = abi.encodeParameters(
    ['address', 'string', 'tuple(address,address)', 'tuple(bytes32,bytes32,bytes32,bytes32)', 'tuple(bytes32,bytes32)'],
    [args.agiTokenAddress, args.baseIpfsUrl, args.ensConfig, args.rootNodes, args.merkleRoots],
  );

  const noPrefix = encoded.startsWith('0x') ? encoded.slice(2) : encoded;
  console.log(noPrefix);
}

try {
  main();
} catch (err) {
  console.error(err.message || err);
  process.exit(1);
}
