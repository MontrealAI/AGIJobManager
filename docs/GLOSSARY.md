# Glossary

- **Job**: a single escrowed work item identified by `jobId` in `AGIJobManager`.
- **Escrow**: employer-funded payout locked in-contract (`lockedEscrow`) until terminal settlement.
- **Agent bond**: stake posted by agent at apply time; returned on agent win, otherwise refunded/slashed per settlement rules.
- **Validator bond**: per-vote stake posted by each validator; subject to slashing if vote is on losing side.
- **Dispute bond**: bond posted by disputant when opening dispute (`disputeJob`).
- **Validator budget**: payout fraction `payout * validationRewardPercentage / 100` earmarked for validator reward distribution logic.
- **Retained revenue**: remainder on agent-win settlement after agent payout + validator budget; stays in contract and may become owner-withdrawable via `withdrawableAGI`.
- **Withdrawable AGI**: `balanceOf(contract) - (lockedEscrow + lockedValidatorBonds + lockedAgentBonds + lockedDisputeBonds)` if non-negative.
- **ENS node / labelhash**: ENS namehash hierarchy where child node is computed from parent node and label hash.
- **Wrapped root**: ENS root owned by NameWrapper (`ens.owner(root) == nameWrapper`) and managed through wrapper calls.
- **Fuse**: NameWrapper permission bit that can be irreversibly burned (here: resolver/TTL related fuses).
- **Identity lock**: one-way `lockIdentityConfiguration()` freeze on token/ENS/root/hook wiring setters protected by `whenIdentityConfigurable`.
- **Pause (`paused`)**: OpenZeppelin pause gate used by intake functions.
- **Settlement pause (`settlementPaused`)**: custom gate for settlement/dispute-sensitive functions.
