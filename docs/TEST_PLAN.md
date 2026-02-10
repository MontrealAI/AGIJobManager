# Test Plan (Deterministic / Mainnet-Grade)

## Deterministic strategy

- Execute on local Truffle `test` network only (no mainnet RPC, no live ENS dependency).
- Use deterministic EVM time travel with `@openzeppelin/test-helpers` (`time.increase`).
- Use bounded scenario loops (fixed sequences, fixed payouts) for invariant-style coverage.

## New suites added

| Suite | Primary risks covered |
| --- | --- |
| `test/jobLifecycle.core.test.js` | create/apply/completion/finalize/expire branch correctness, challenge-window behavior, tie/under-quorum dispute forcing, refund branch checks. |
| `test/validatorVoting.bonds.test.js` | vote uniqueness, no double-vote, validator bond sizing consistency and accounting updates. |
| `test/disputes.moderator.test.js` | dispute bond sizing, typed resolution behavior (`NO_ACTION`, agent win), stale-dispute owner path, moderator access control. |
| `test/escrowAccounting.invariants.test.js` | bounded multi-job mixed outcomes with per-step solvency invariant checks (`balance >= locked totals`, `withdrawableAGI` equation). |
| `test/pausing.accessControl.test.js` | `paused` vs `settlementPaused` gating, settlement-only operations, `withdrawAGI` guardrails. |
| `test/agiTypes.safety.test.js` | AGI type validation (zero/EOA/non-ERC721 rejection), disable behavior, misbehaving type isolation from `applyForJob`. |
| `test/ensHooks.integration.test.js` | ENS hooks best-effort integration with `ENSJobPages`, create/assign/completion/revoke lifecycle, lock+burn semantics and failure isolation. |
| `test/identityConfig.locking.test.js` | identity config mutability blocked while obligations exist, then allowed only after zero locked totals, and permanently frozen by `lockIdentityConfiguration`. |

## Mocks/helpers introduced

- `contracts/test/MockNameWrapperReverting.sol` to validate wrapper fuse-burn failure isolation.
- `test/helpers/fixture.js` for deterministic deployment/setup re-use.

## Requirement mapping

- Lifecycle/escrow/dispute/quorum/pausing/access control: covered across the eight suites above.
- AGIType safety and non-bricking behavior: covered in `agiTypes.safety`.
- ENS best-effort hooks and fuse API semantics: covered in `ensHooks.integration`.
- Identity lock operational safety: covered in `identityConfig.locking`.
