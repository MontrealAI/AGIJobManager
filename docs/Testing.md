# Testing

This repository uses Truffle with a local Ganache chain for testing. The default `truffle test` command runs against an in-process Ganache provider defined in `truffle-config.js`, so no environment variables are required for local unit tests.

## Quickstart

```bash
npm install
npx truffle compile
npx truffle test
```

## Running against a local development chain (Ganache)

If you prefer a persistent local chain, start Ganache and run Truffle against the `development` network:

```bash
npx ganache -p 8545
npx truffle test --network development
```

## Test-only mocks

The test suite includes minimal mock contracts under `contracts/test/`:

- **MockERC20** / **FailTransferToken** / **FailingERC20**: ERC‑20 mocks to simulate successful transfers and `transfer`/`transferFrom` failures.
- **MockERC721**: ERC‑721 mock used for AGIType payout boosts.
- **MockENS**, **MockResolver**, **MockNameWrapper**: deterministic ENS/NameWrapper mocks for access gating tests.

## Extending tests

- Add new scenarios under `test/` and reuse the helper utilities in `test/AGIJobManager.full.test.js`.
- Keep mocks deterministic and minimal, and avoid modifying `contracts/AGIJobManager.sol`.
