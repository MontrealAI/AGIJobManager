# Testing Guide

This repository uses **Truffle + Mocha** against the local in-memory `test` Ganache provider configured in `truffle-config.js`.

## CI-parity command order

Mirror `.github/workflows/ci.yml` locally:

```bash
npm install
npm run lint
npm run build
npm run size
npm test
npm run test:ui
```

## Baseline at repository HEAD (inventory run)

Executed in this exact order on a clean checkout:

1. `npm install`
2. `npm run lint`
3. `npm run build`
4. `npm run size`
5. `npm run test`

Observed baseline:

- `npm run size`: `AGIJobManager runtime bytecode size: 24574 bytes` (within EIP-170 cap, near the limit).
- `npm run test`: `264 passing` on local Ganache `test` network.

> Note: CI also runs `npm run test:ui` after contract tests.

## Canonical scripts (`package.json`)

| Script | Command | Purpose |
| --- | --- | --- |
| `npm run build` | `truffle compile` | Compile all contracts with pinned solc settings. |
| `npm run size` | `node scripts/check-bytecode-size.js` | EIP-170 runtime-size guard. |
| `npm run lint` | `solhint "contracts/**/*.sol"` | Solidity lint policy. |
| `npm test` | `truffle compile --all && truffle test --network test && node test/AGIJobManager.test.js && node scripts/check-contract-sizes.js` | Full contract test + artifact sanity. |
| `npm run test:ui` | `node scripts/ui/run_ui_smoke_test.js` | UI smoke checks. |

## Test strategy

### Layers

1. **Lifecycle integration tests** (`test/AGIJobManager.*`, `test/happyPath.test.js`, `test/livenessTimeouts.test.js`, `test/escrowAccounting.test.js`)
   - Operator-run job lifecycle, payout/escrow transitions, dispute/timeout liveness.
2. **Security/economic regression tests** (`test/securityRegression.test.js`, `test/disputeHardening.test.js`, `test/invariants.solvency.test.js`, `test/completionSettlementInvariant.test.js`)
   - Solvency, no-double-release, race prevention, dispute and pause behavior.
3. **ENS integration tests** (`test/ensJobPagesHooks.test.js`, `test/ensJobPagesHelper.test.js`, `test/namespaceAlpha.test.js`)
   - ENS hooks are best-effort and must not brick core settlement.
4. **Utility-library tests** (`test/invariants.libs.test.js`, `test/utils.uri-transfer.test.js`)
   - Bond/reputation arithmetic, ENS ownership checks, URI validation, transfer wrappers.

## Determinism runbook

- Always run tests on `--network test`.
- Use explicit EVM time helpers (`time.increase`, `time.advanceBlock`) in timeout/dispute tests.
- Use `BN` math (`web3.utils.toBN`) for token arithmetic.
- Keep tests offline: no public RPC endpoints and no secrets.

## Running focused tests

Single file:

```bash
npx truffle test --network test test/utils.uri-transfer.test.js
```

Patterned execution (shell glob):

```bash
npx truffle test --network test test/*dispute*.test.js
```

## Troubleshooting

| Symptom | Likely cause | Remediation |
| --- | --- | --- |
| `contains unresolved libraries` on `UtilsHarness` | Truffle library links not deployed in test setup | Deploy/link required libraries inside `beforeEach` before `UtilsHarness.new()`. |
| `TransferFailed` custom-error-style reverts | Token returned `false`, reverted, or under-delivered transfer amount | Validate approvals/balances; for fee-on-transfer tokens expect `safeTransferFromExact` to revert. |
| Bytecode gate fails | Runtime crossed EIP-170 threshold | Run `npm run size`, inspect recent contract-size growth, avoid feature bloat in core contract. |
| Flaky timeout tests | Missing deterministic block/time advancement | Add explicit time travel + mine step before timeout-sensitive actions. |


## Additional deterministic suites (mainnet-grade additions)

| Feature | New suite |
| --- | --- |
| Core lifecycle transitions / finalize branches | `test/jobLifecycle.core.test.js` |
| Validator bonds and vote correctness | `test/validatorVoting.bonds.test.js` |
| Moderator dispute and stale dispute owner recovery | `test/disputes.moderator.test.js` |
| Escrow solvency pseudo-fuzz loop | `test/escrowAccounting.invariants.test.js` |
| Pause and settlement pause access controls | `test/pausing.accessControl.test.js` |
| AGIType safety and broken ERC721 isolation | `test/agiTypes.safety.test.js` |
| ENS hook best-effort integration | `test/ensHooks.integration.test.js` |
| Identity config locking lifecycle | `test/identityConfig.locking.test.js` |

## Known offline-test limitation

- ENS tokenURI malformed-return handling is constrained by the current production implementation: empty ENS tokenURI responses are covered and correctly fall back, but malformed ABI payload simulation is documented as an operational caveat because the decode path is inside production minting logic and the runtime bytecode budget is already near the EIP-170 ceiling.
