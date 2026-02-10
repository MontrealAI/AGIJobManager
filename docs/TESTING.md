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


## Added deterministic suites (mainnet-grade hardening)

| Feature | Test file |
| --- | --- |
| Job lifecycle branch coverage | `test/jobLifecycle.core.test.js` |
| Validator vote/bond accounting | `test/validatorVoting.bonds.test.js` |
| Dispute + moderator flows | `test/disputes.moderator.test.js` |
| Escrow/accounting invariants | `test/escrowAccounting.invariants.test.js` |
| Pause/settlement gate controls | `test/pausing.accessControl.test.js` |
| AGI type safety | `test/agiTypes.safety.test.js` |
| ENS best-effort hooks | `test/ensHooks.integration.test.js` |
| Identity lock semantics | `test/identityConfig.locking.test.js` |
