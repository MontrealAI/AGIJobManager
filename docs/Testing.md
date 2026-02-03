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

By default the Truffle config keeps `viaIR` disabled. Enable it only if you hit stack-too-deep errors,
and keep the setting consistent for verification.

## Run the full test suite

```bash
npx truffle test
```

## Scenario/state-machine tests (escrow + NFT marketplace economics)

Run the deterministic economic lifecycle scenarios:

```bash
npx truffle test test/scenarioEconomicStateMachine.test.js
```

Coverage highlights:
- Happy path lifecycle (escrow funding → apply → completion → validator approvals → settlement → NFT issuance → listing → purchase).
- Negative paths (pause behavior, blacklist/role gating failures, invalid state transitions, dispute branches).
- Invariants (no double payout, no payout in non-terminal states, no stuck escrow, listings can’t be purchased twice or after delist).

Troubleshooting tips:
- **NotAuthorized / Blacklisted**: ensure the test fixture addrs are allowlisted via `addAdditionalAgent` / `addAdditionalValidator` and not blacklisted.
- **Pausable: paused**: confirm pause/unpause sequencing in local edits to the tests.
- **InvalidState**: check that job assignment, completion, and dispute phases match the contract state machine.

## Notes on test-only mocks

The test suite relies on minimal mocks under `contracts/test/`:

- `MockERC20`, `FailingERC20`, `ERC20NoReturn`: exercise ERC-20 transfer edge cases.
- `MockENS`, `MockResolver`, `MockNameWrapper`: deterministic ENS ownership gating in tests.
- `MockERC721`: simulate AGIType NFT boosts.

Local tests run entirely against the in-memory Truffle chain (or a Ganache `development` network)
and do not require any `.env` configuration for the default setup.

These mocks are **test-only** and are not deployed in production.

## Comprehensive coverage suite

`test/AGIJobManager.exhaustive.test.js` exercises deployment defaults, lifecycle flows, dispute resolution, hardening regressions, and ENS/Merkle role gating. Use it as the starting point when extending coverage for new behaviors.

## Extending tests

- Prefer reusing helper utilities in `test/helpers/`.
- Use deterministic Truffle accounts (`accounts[0..]`).
- Keep the suite fast by avoiding large loops; the contract already enforces a 50-validator cap.
