# Testing AGIJobManager

This repository uses Truffle + Ganache for local testing. The suite includes mock contracts for ENS/NameWrapper/Resolver, ERC-20 transfer failures, and AGIType ERC-721s so we can validate the safety fixes without touching production code.

## Local setup

Install dependencies:

```bash
npm install
```

Start Ganache in a separate terminal (development network):

```bash
npx ganache -p 8545 --wallet.mnemonic "test test test test test test test test test test test junk"
```

Compile and run tests against the local `development` network:

```bash
truffle compile
truffle test --network development
```

## Mocks used in tests

The test suite uses the following test-only contracts under `contracts/test/`:

- `MockERC20`: basic ERC-20 for escrow and payouts.
- `FailingERC20` / `FailTransferToken`: ERC-20s that return `false` for `transfer` / `transferFrom`.
- `MockENS`, `MockResolver`, `MockNameWrapper`: ENS gating mocks.
- `MockERC721`: AGIType NFT for payout boosts.

## Extending the tests

Most tests share helper utilities in `test/helpers/`:

- `ens.js` for constructing namehash/root/subnode values and setting mock ownership.
- `errors.js` for asserting custom error selectors.

Add new scenarios by reusing these helpers and creating focused test cases for new behaviors. Keep job IDs and test data deterministic to ensure consistent results across runs.
