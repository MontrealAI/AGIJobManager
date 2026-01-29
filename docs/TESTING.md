# Testing Guide

This repository uses Truffle with an in‑process Ganache provider (see `truffle-config.js`). The default test run spins up a local chain automatically.

## Install dependencies
```bash
npm install
```

## Run compile
```bash
npx truffle compile
```

## Run all tests
```bash
npx truffle test
```

## Run against a local Ganache instance
```bash
npx ganache -p 8545
npx truffle test --network development
```

## ENS / NameWrapper mocks
Identity gating in AGIJobManager relies on ENS resolver, NameWrapper ownership, or Merkle proofs. The test suite uses mocks under `contracts/test/`:
- `MockENS` → stores a resolver per node
- `MockResolver` → maps node → address
- `MockNameWrapper` → maps node → owner

Tests create deterministic subnodes using:
```
subnode = keccak256(rootNode, keccak256(subdomain))
```
This allows tests to pass `_verifyOwnership` without external dependencies.

## Test suites
- `test/happyPath.test.js` — end‑to‑end happy path
- `test/securityRegression.test.js` — takeover prevention, vote rules, dispute behavior, transfer checks
- `test/nftMarketplace.test.js` — list/purchase/delist flows
- `test/adminOps.test.js` — pause, allowlists, blacklists, withdrawals
- Existing regression suites remain in `test/` for backward coverage.
