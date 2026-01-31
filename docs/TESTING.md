# Testing Guide

This repository uses Truffle with an in‑process Ganache provider (see `truffle-config.js`). Use the `test` network to run against the in‑process chain, or run Ganache locally for the `development` network.

## Install dependencies
```bash
npm install
```

## Run compile
```bash
npx truffle compile
```

## Run all tests (in‑process provider)
```bash
npx truffle test --network test
```

## Run against a local Ganache instance
```bash
npx ganache -p 8545
npx truffle test --network development
```

## Run all tests (development default)
```bash
npx truffle test
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
- `test/scenarioLifecycle.marketplace.test.js` — scenario coverage for lifecycle, disputes, pause behavior, and marketplace invariants
- Existing regression suites remain in `test/` for backward coverage.

## Scenario coverage (contract-level)
The scenario suite (`test/scenarioLifecycle.marketplace.test.js`) exercises the contract in deterministic flows that map to the lifecycle diagram in the README:
- **Create → apply → validate → complete** with escrow funding, payouts, reputation updates, and NFT issuance.
- **Assigned → validate → complete** without a completion request to cover the direct validator approval path.
- **Cancel** before assignment with escrow refunds and job deletion semantics.
- **Dispute** paths (thresholded disapprovals, manual disputes, moderator resolutions) covering agent win, employer win, and neutral outcomes.
- **Neutral dispute escrow** behavior (funds remain locked until validators complete the job after a non-canonical resolution).
- **Pause/unpause** behavior that blocks when-not-paused actions and resumes normal operation.
- **Marketplace** listing/purchase flows, self-purchase behavior, and invariant checks (no double-purchase, invalid listings, insufficient allowance).
- **Economic assertions** including escrow conservation, marketplace payout transfers, and zero remaining contract balance after expected payouts.
- **Event assertions** for JobCreated/JobApplied/NFTPurchased to keep regressions visible at the log level.
- **Custom error selector checks** for InvalidState/NotAuthorized to catch regression in revert surfaces.

Run it locally with the standard test command:
```bash
npx truffle test --network test test/scenarioLifecycle.marketplace.test.js
```
