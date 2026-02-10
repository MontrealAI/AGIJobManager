# Architecture

## System purpose
`AGIJobManager` is an owner-operated escrow and settlement contract for AI job workflows: create funded jobs, assign eligible agents, collect validator signals, settle payouts/refunds, resolve disputes, and mint completion NFTs.

## High-level components
- **AGIJobManager (core protocol):** escrow, lifecycle state machine, roles, payouts, disputes, reputation, ERC-721 completion NFT.
- **ENSJobPages (optional companion):** best-effort ENS page creation and updates per job.
- **AGI ERC-20 (external):** funding asset for escrow and bonds.
- **AGIType ERC-721 contracts (external):** gate agent payout tier snapshots during `applyForJob`.

## Logical architecture (text diagram)

```text
Employer ---approve+create---> AGIJobManager <---apply+bond--- Agent
   |                                  |                         |
   |                                  |---validate/disapprove-- Validators
   |                                  |
   |                                  |---resolve disputes----- Moderators/Owner (stale)
   |                                  |
   |                                  |---mint completion NFT-> Employer
   |                                  |
   |                                  |---best-effort hooks---> ENSJobPages -> ENS Registry/Resolver/NameWrapper
   |
AGI ERC20 balances and lock accounting remain in AGIJobManager
```

## Trust model
- Centralized operations by contract owner.
- Moderators resolve active disputes.
- Owner can stale-resolve after `disputeReviewPeriod`.
- Validator and agent eligibility are permissioned via additional allowlists OR Merkle proof OR ENS ownership checks.
- Two pause controls:
  - `pause()` / `unpause()` (`Pausable`): blocks `whenNotPaused` actions.
  - `setSettlementPaused(bool)`: separately blocks settlement functions guarded by `whenSettlementNotPaused`.

## Key safety/accounting design
- Escrow and bonds are tracked in four locked buckets:
  - `lockedEscrow`
  - `lockedAgentBonds`
  - `lockedValidatorBonds`
  - `lockedDisputeBonds`
- Owner treasury withdrawals use `withdrawableAGI()` and revert if `balance < lockedTotal`.
- ENS hooks are intentionally best-effort and non-blocking for settlement liveness.

## Upgrade posture
- This system is **not proxy-upgradeable** in-repo.
- Operational changes are parameter/config changes by owner.
- Major logic changes require redeployment and migration planning.
