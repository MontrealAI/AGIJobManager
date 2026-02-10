# Test Plan (Mainnet-Grade Deterministic Suites)

## Determinism rules

- All suites run on Truffle's local `test` network (Ganache in-process).
- No test depends on live ENS, mainnet RPC, or external API calls.
- Time-dependent assertions use `@openzeppelin/test-helpers/time` (`increase`) with fixed values.
- Invariant-style loops are bounded and seeded with fixed patterns (no random sources).

## New suites in this patch

| Suite | Focus | Mainnet risk addressed |
| --- | --- | --- |
| `test/jobLifecycle.core.test.js` | create/apply/completion/finalize/expire branches | settlement deadlocks and invalid transitions |
| `test/validatorVoting.bonds.test.js` | vote constraints, bond sizing, slashing/rewards | validator incentive integrity |
| `test/disputes.moderator.test.js` | dispute bond sizing, moderator/owner paths, stale disputes | dispute liveness and role misuse |
| `test/escrowAccounting.invariants.test.js` | bounded multi-job solvency checks | escrow insolvency and accounting drift |
| `test/pausing.accessControl.test.js` | pause vs settlementPause gating + withdraw semantics | break-glass misuse and blocked exits |
| `test/agiTypes.safety.test.js` | AGI type validation and broken ERC721 isolation | agent onboarding bricking risks |
| `test/ensHooks.integration.test.js` | ENS hook best-effort + fuse burning API behavior | ENS dependency failures affecting core settlement |
| `test/identityConfig.locking.test.js` | pre-lock mutability checks + permanent lock behavior | post-deploy config tampering |

## Fixtures and helpers

- Added `test/helpers/mainnetFixture.js` to keep deployments deterministic and readable.
- Fixture intentionally uses explicit owner seeding and allowlists (`addAdditionalAgent` / `addAdditionalValidator`) instead of environment-dependent identity wiring.

## Invariants asserted

- Locked totals (`lockedEscrow`, `lockedAgentBonds`, `lockedValidatorBonds`, `lockedDisputeBonds`) remain solvent relative to token balance.
- `withdrawableAGI()` equals `balanceOf(manager) - lockedTotals` after every bounded settlement iteration.
- Dispute `NO_ACTION` does not clear disputed state.
- Disabled AGI types are ignored before any external ERC721 call path.
