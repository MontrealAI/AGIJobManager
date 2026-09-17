# v0.5.0 validation

Application commit: `73a632f75cb513977d892b0d4bc6dd412b0cba32`.
Application tree: `80276ef5a9d44a3c832694b3cde6659469023c7a`.

## Source CI evidence

Publication requires every run below to report **completed / success** for the exact application commit. The release workflow rechecks the GitHub API before creating the annotated tag or publishing any release. `SOURCE_CI.json` records these requirements and immutable run identifiers; the linked logs contain the full outcomes.

| Gate | Evidence |
| --- | --- |
| Solidity lint, build, size, full Truffle regressions, ABI smoke and browser smoke | [CI run](https://github.com/MontrealAI/AGIJobManager/actions/runs/35176057838) |
| Documentation and generated reference consistency | [Docs run](https://github.com/MontrealAI/AGIJobManager/actions/runs/35176057812) |
| Foundry unit/fuzz, invariants and configured Slither analysis | [Security run](https://github.com/MontrealAI/AGIJobManager/actions/runs/35176057774) |
| UI lint/types/build, unit/property/runtime tests, browser end-to-end/accessibility/header checks and deterministic artifact checks | [UI run](https://github.com/MontrealAI/AGIJobManager/actions/runs/35176057805) |

## USDC-specific coverage

- Constructor rejects wrong decimals, missing code, noncanonical public-chain tokens and unsupported public chains.
- Exact one-micro-USDC escrow/refund and fractional transfer accounting.
- Paused transfers and blocked recipients revert operations atomically; retries preserve balances and escrow accounting.
- Six-decimal economic defaults and reputation behavior.
- Canonical token/network preflight, wrong spender rejection, amount precision and uint256 bounds.
- Standalone console boot with no default manager, transaction gating, bond calculations and wallet-context invalidation.

The primary console verifier exercises 35 checks against the frozen source; the UI suite includes 115 unit/runtime/property tests. The security run includes 15 unit/fuzz tests and one handler-invariant suite, with zero results from the configured Slither detector set. Slither excludes selected detectors and paths as documented in `slither.config.json`; zero reported results are not an exhaustive absence-of-vulnerabilities claim.

## Reproducible packaging

The release archive uses a pinned commit/tree, a complete change inventory, deterministic ordering and timestamps, and per-file SHA-256 digests. CI rebuilds the release twice and compares every output. The publisher verifies GitHub asset digests, refuses tag repointing or mismatching assets, and publishes only after verification. A matching draft can be resumed.

## Boundaries

No live deployment or live-funds transaction is performed. Canonical USDC checks and transfer restrictions are tested with local fixtures; they do not prove the behavior of an arbitrary deployed manager. Historical source records remain provenance, not USDC deployment receipts. Existing on-chain contracts are not upgraded. USDC issuer controls, owner privileges and optional ENS dependencies remain operational assumptions. This release is not an independent security audit or live-deployment certification.
