# Testing Guide

This repository uses **Truffle + Mocha** with a deterministic in-memory Ganache network (`--network test`) for contract tests.

## CI parity workflow

`/.github/workflows/ci.yml` runs checks in this order:

1. `npm install`
2. `npm run lint`
3. `npm run build`
4. `npm run size`
5. `npm run test`
6. `npm run test:ui`

For local parity (excluding browser install), run the same sequence.

## Canonical npm scripts

From `package.json`:

- Build: `npm run build`
- Lint Solidity: `npm run lint`
- Runtime size gate: `npm run size`
- Full contract+script pipeline: `npm test`
- UI smoke tests: `npm run test:ui`
- ABI export/check for UI: `npm run ui:abi` / `npm run ui:abi:check`

`npm test` currently executes:

```bash
truffle compile --all && truffle test --network test && node test/AGIJobManager.test.js && node scripts/check-contract-sizes.js
```

## Running targeted tests

Single file:

```bash
truffle test --network test test/ensJobPagesHooks.test.js
```

Multiple files:

```bash
truffle test --network test test/invariants.solvency.test.js test/utils.transfer_uri.test.js
```

## Test strategy

- **Integration/state-machine**: end-to-end job lifecycle, disputes, expiry, finalization, escrow accounting.
- **Security regression tests**: historical bug classes and adversarial behavior.
- **Invariant-style tests**: solvency and locked-funds accounting checks after transitions.
- **ENS integration tests**: hook resilience and `ENSJobPages` wrapped/unwrapped behavior.
- **Utility unit tests**: `BondMath`, `ReputationMath`, `ENSOwnership`, `TransferUtils`, and `UriUtils` behavior.

## Determinism and anti-flake rules

- Use only `--network test` (Ganache provider from `truffle-config.js`).
- Do not use real RPC endpoints in tests.
- Control time with EVM helpers (`evm_increaseTime` + `evm_mine` or OZ `time.increase`).
- Use `BN` math for all token/accounting values (never JS floating arithmetic).
- Assert state + events + balances, not only “no revert”.

## Troubleshooting

- **`TransferFailed` custom error**: check token mocks used in the test and allowance/balance setup.
- **ENS hook assertions fail**: verify ENS wiring (`setENSJobPages`, root ownership, resolver) in fixture setup.
- **Bytecode gate fails**: run `npm run size` and `node scripts/check-contract-sizes.js` to inspect runtime bytes.
- **Long-running suite**: this repository has a large integration suite; running all tests can take several minutes.
- **UI smoke failures**: in CI parity environments, ensure Chromium is installed (`npx playwright install --with-deps chromium`).
