# Glossary

- **Escrow (`lockedEscrow`)**: Aggregate AGI payout funds reserved for unsettled jobs.
- **Agent bond**: AGI amount posted by assigned agent at `applyForJob`; returned/slashed based on terminal outcome.
- **Validator bond**: AGI amount posted per validator vote; redistributed with slashing and reward logic.
- **Dispute bond**: Bond posted by manual dispute initiator (`disputeJob`) and refunded to winner side.
- **Completion review period**: Window after completion request during which validators can vote and disputes can be raised.
- **Challenge period after approval**: Additional delay after fast approval threshold before early finalize is allowed.
- **Dispute review period**: Delay before owner may resolve stale disputes.
- **Vote quorum**: Minimum vote count for non-zero-vote finalize decisions to avoid low-participation outcomes.
- **Fast approval path**: Branch where approvals crossing threshold set `validatorApprovedAt` and allow post-challenge finalize.
- **Slow path finalize**: Post-review-window settlement branch using quorum and vote balance.
- **Best-effort hooks**: Non-blocking ENS hook calls that may fail without reverting core protocol execution.
- **ENS root node**: Namespace root hash used to verify subdomain ownership and/or create job pages.
- **Wrapped root**: ENS root owned by `NameWrapper`; subname operations go through wrapper APIs.
- **Unwrapped root**: ENS root directly owned in ENS registry; subname operations use registry APIs.
- **Merkle root allowlist**: Address allowlist root used for validator/agent authorization via proofs.
- **Identity configuration lock**: Irreversible owner action freezing token/ENS/root wiring updates.
- **Settlement pause**: Owner toggle that blocks settlement-sensitive flows via `whenSettlementNotPaused`.
- **Protocol treasury (withdrawable AGI)**: Token balance surplus after subtracting all locked liabilities.
