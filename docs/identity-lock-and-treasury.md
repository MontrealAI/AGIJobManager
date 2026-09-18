# Identity lock and treasury controls — v1.0.0

Use [owner controls](OWNER_CONTROLS.md) for transaction steps and [trust model](trust-model-and-security-overview.md) for authority and accounting assumptions.

## Withdrawable USDC

The owner can withdraw only unreserved USDC: balance minus job escrow, agent bonds, validator bonds and dispute bonds. `withdrawUSDC` also requires paused intake and settlement enabled. Successful jobs distribute their entire cost; unused validator allocations and rounding go to the winning party under the outcome rules, not retained job revenue. Direct unreserved donations may create surplus.

Never send job funding directly to the manager address. The employer's `createJob` call pulls the approved USDC and records escrow. A direct transfer is not a job and may be withdrawable surplus.

## Pause controls

- `pauseIntake()` stops creation/assignment while existing completion, voting, disputes, refunds and settlement remain available under their guards.
- `setSettlementPaused(true)` blocks those settlement-lane actions and also creation/assignment.
- `pauseAll()` sets both flags. Reads remain available and timestamps keep advancing.

Use the [incident guide](OPERATIONS/INCIDENT_RESPONSE.md) for staged recovery. A pause cannot bypass USDC issuer restrictions.

## Irreversible identity lock

`lockIdentityConfiguration()` freezes `updateEnsRegistry`, `updateNameWrapper`, `updateRootNodes` and `setEnsJobPages`. It does not freeze Merkle roots, direct eligibility lists, moderators, ownership or other supported owner settings. USDC is immutable independently of this lock.

Validate the intended addresses, ENS ownership, hook behavior and recovery implications before locking. Registry/wrapper/root updates require all live job escrow and bonds empty; the hook pointer has distinct guards. Consult the [generated interface](REFERENCE/CONTRACT_INTERFACE.md) and [owner guide](OWNER_RUNBOOK.md). Never use the identity lock as an incident repair.
