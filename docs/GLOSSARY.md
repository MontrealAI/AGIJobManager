# Glossary

- **Job**: a single escrowed work item in `AGIJobManager` with employer, payout, duration, and lifecycle flags.
- **Escrow (`lockedEscrow`)**: sum of unsettled job payouts reserved in-contract.
- **Agent bond**: AGI posted by assigned agent at apply time; returned/slashed depending on outcome.
- **Validator bond**: AGI posted per validator vote; partially slashable via `validatorSlashBps`.
- **Dispute bond**: AGI posted when employer/agent calls `disputeJob`.
- **Validator budget**: portion of payout allocated to validator rewards (`validationRewardPercentage`).
- **Retained revenue**: remainder of payout on agent-win after agent payout + validator budget.
- **`withdrawableAGI`**: contract AGI balance minus all locked escrow/bond buckets.
- **Completion review period**: voting/dispute window after completion request.
- **Challenge period after approval**: extra delay after approval threshold before immediate finalize branch.
- **Dispute review period**: time after which owner can force-resolve stale disputes.
- **Merkle root**: root used to prove role eligibility (agent/validator).
- **ENS node**: namehash-like node identifying a name in ENS.
- **Labelhash**: keccak256 of a single ENS label (e.g., `job-123`).
- **Wrapped root**: ENS root owned by NameWrapper contract.
- **Fuse**: NameWrapper permission bit; this repo uses `CANNOT_SET_RESOLVER` and `CANNOT_SET_TTL` for optional lock.
- **Best-effort hook**: external ENS hook call whose failure does not revert core settlement flow.
