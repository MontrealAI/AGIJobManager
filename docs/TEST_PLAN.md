# Risk-Based Test Plan

This plan maps mainnet-relevant risks to concrete suites at current HEAD.

## Repository inventory snapshot

- Tooling: Truffle 5.x, Ganache 7.x, Solidity `0.8.23` (viaIR disabled), Mocha.
- CI workflow: lint → build → size → full tests → UI smoke.
- Existing tests: `test/*.test.js` plus script-based checks (`test/AGIJobManager.test.js`).

## Priority risks and suites

1. **Escrow safety / solvency**
   - `test/escrowAccounting.test.js`
   - `test/invariants.solvency.test.js`
   - `test/completionSettlementInvariant.test.js`
2. **State-machine correctness and liveness**
   - `test/happyPath.test.js`
   - `test/livenessTimeouts.test.js`
   - `test/scenarioEconomicStateMachine.test.js`
3. **Dispute and moderation controls**
   - `test/disputeHardening.test.js`
   - `test/securityRegression.test.js`
4. **Owner/moderator permissioning + pause controls**
   - `test/adminOps.test.js`
   - `test/economicSafety.test.js`
5. **ENS integration resilience**
   - `test/ensJobPagesHooks.test.js`
   - `test/ensJobPagesHelper.test.js`
6. **Utility libraries and transfer semantics**
   - `test/invariants.libs.test.js`
   - `test/utils.transfer_uri.test.js`

## Coverage matrix

| Feature / risk | Test files | Contracts |
|---|---|---|
| create/apply/complete/finalize lifecycle | `happyPath`, `AGIJobManager.comprehensive`, `AGIJobManager.full` | `contracts/AGIJobManager.sol` |
| Dispute open/resolve/stale-resolve | `disputeHardening`, `livenessTimeouts`, `securityRegression` | `contracts/AGIJobManager.sol` |
| Escrow + bond accounting invariants | `escrowAccounting`, `invariants.solvency`, `completionSettlementInvariant` | `contracts/AGIJobManager.sol` |
| Pause/owner/moderator protections | `adminOps`, `economicSafety` | `contracts/AGIJobManager.sol` |
| ENS hooks best-effort behavior | `ensJobPagesHooks` | `contracts/AGIJobManager.sol`, `contracts/ens/IENSJobPages.sol` |
| ENSJobPages wrapped/unwrapped + lock/fuses | `ensJobPagesHelper` | `contracts/ens/ENSJobPages.sol` |
| Bond/reputation/ownership math and utility checks | `invariants.libs`, `utils.transfer_uri` | `contracts/utils/*`, `contracts/test/UtilsHarness.sol` |
| EIP-170 runtime guard | `bytecodeSize.test.js`, `scripts/check-bytecode-size.js` | `contracts/AGIJobManager.sol` |

## Regression policy

When changing the following, update these tests in the same PR:

- `AGIJobManager` settlement/dispute logic → escrow, liveness, and dispute suites.
- ENS hook integration or tokenURI logic → ENS hook + ENS helper suites.
- Utility library behavior (`TransferUtils`, `UriUtils`, bond/reputation math) → utility unit suites.
- Owner/operator controls → admin and security regression suites.

Do not merge logic changes without matching regression assertions for the modified path.
