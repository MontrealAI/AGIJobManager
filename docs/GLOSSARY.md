# Glossary

- **Escrow (`lockedEscrow`)**: reserved job payout principal for unsettled jobs.
- **Agent bond (`lockedAgentBonds`)**: bond posted by assigned agent when applying.
- **Validator bond (`lockedValidatorBonds`)**: bond posted per validator vote.
- **Dispute bond (`lockedDisputeBonds`)**: bond posted on manual dispute initiation.
- **Withdrawable AGI**: token balance minus all locked buckets; owner treasury surplus only.
- **Completion review period**: post-completion voting/dispute window.
- **Challenge period after approval**: additional delay after validator-approval threshold before finalize.
- **Dispute review period**: timeout after which owner can stale-resolve a dispute.
- **Quorum (`voteQuorum`)**: minimum votes for decisive validator path.
- **Approval/disapproval thresholds**: votes required to classify outcome direction.
- **Best-effort ENS hooks**: optional ENS calls that do not revert core settlement on failure.
- **Wrapped root**: ENS root controlled by NameWrapper.
- **Fuses**: NameWrapper permission bits; this repo uses resolver/TTL lock fuses in lock-burn mode.
- **AGI type**: ERC-721-based payout tier source used to determine agent payout percentage.
- **Identity lock**: irreversible lock disabling token/ENS/root rewiring functions.
