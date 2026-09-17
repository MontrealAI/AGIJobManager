# Testing

## Local prerequisites

Use Node.js 22.23.2 and npm with both committed lockfiles. Hardhat 3 provides the local EVM, and Mocha runs the existing regression tests through the repository's compatibility adapter. Truffle and Ganache are no longer required or installed.

## Install dependencies

From the repository root:

```bash
npm ci
npm --prefix hardhat ci
```

## Compile contracts

```bash
npm run build
```

This invokes the qualified Hardhat compiler profile and exports the artifacts used by repository scripts. Preserve the committed compiler settings when comparing release bytecode.

## Run the full contract test suite

```bash
npm test
```

The runner starts and closes its disposable Hardhat chain automatically. No external RPC, signing key or `.env` file is needed. See [the complete testing guide](TESTING.md) for the separate UI, deployment, fuzz, invariant and security gates.

## Scenario/state-machine tests (escrow + NFT issuance)

The full command above includes `test/scenarioEconomicStateMachine.test.js`, which exercises the deterministic economic lifecycle scenarios.

Coverage highlights:
- Happy path lifecycle (escrow funding → apply → completion → validator approvals → settlement → NFT issuance).
- Negative paths (pause behavior, blacklist/role gating failures, invalid state transitions, dispute branches).
- Invariants (no double payout, no payout in non-terminal states, no stuck escrow).

Troubleshooting tips:
- **NotAuthorized / Blacklisted**: ensure the test fixture addrs are allowlisted via `addAdditionalAgent` / `addAdditionalValidator` and not blacklisted.
- **Pausable: paused**: confirm pause/unpause sequencing in local edits to the tests.
- **InvalidState**: check that job assignment, completion, and dispute phases match the contract state machine.

## Notes on test-only mocks

The test suite relies on minimal mocks under `contracts/test/`:

- `MockERC20`, `FailingERC20`, `ERC20NoReturn`: exercise ERC-20 transfer edge cases.
- `MockENS`, `MockResolver`, `MockNameWrapper`: deterministic ENS ownership gating in tests.
- `MockERC721`: simulate AGIType NFT boosts.

Local tests run entirely against the in-memory Hardhat chain and do not require any `.env` configuration for the default setup.

These mocks are **test-only** and are not deployed in production.

## Comprehensive coverage suite

`test/AGIJobManager.exhaustive.test.js` exercises deployment defaults, lifecycle flows, dispute resolution, hardening regressions, and ENS/Merkle role gating. Use it as the starting point when extending coverage for new behaviors.

## Extending tests

- Prefer reusing helper utilities in `test/helpers/`.
- Use the deterministic local accounts supplied by the test runtime (`accounts[0..]`).
- Keep the suite fast by avoiding large loops; the contract already enforces a 50-validator cap.
