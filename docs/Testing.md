# Testing

## Local prerequisites

- Node.js + npm
- Truffle (via `npx truffle`)
- Ganache (for the `development` network)

## Install dependencies

```bash
npm install
```

## Start a local chain (Ganache)

```bash
npx ganache -p 8545
```

## Compile contracts

```bash
npx truffle compile
```

## Run the full test suite

```bash
npx truffle test
```

## Notes on test-only mocks

The test suite relies on minimal mocks under `contracts/test/`:

- `MockERC20`, `FailingERC20`, `ERC20NoReturn`: exercise ERC-20 transfer edge cases.
- `MockENS`, `MockResolver`, `MockNameWrapper`: deterministic ENS ownership gating in tests.
- `MockERC721`: simulate AGIType NFT boosts.

Local tests run entirely against the in-memory Truffle chain (or a Ganache `development` network)
and do not require any `.env` configuration for the default setup.

These mocks are **test-only** and are not deployed in production.

## Extending tests

- Prefer reusing helper utilities in `test/helpers/`.
- Use deterministic Truffle accounts (`accounts[0..]`).
- Keep the suite fast by avoiding large loops; the contract already enforces a 50-validator cap.
