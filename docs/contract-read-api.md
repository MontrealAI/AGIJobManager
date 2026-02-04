# Contract read API (job getters)

## Why `jobs` is internal
The `jobs` mapping is now `internal` to avoid the legacy Solidity codegen stack-too-deep error without enabling `viaIR`. This removes the giant auto-generated tuple getter from the ABI while keeping job lifecycle behavior unchanged.

## Read getters for jobs
Use the targeted read functions below instead of `jobs(jobId)`:

- `getJobCore(jobId)` → employer, assignedAgent, payout, duration, assignedAt, completed, disputed, expired, agentPayoutPct
- `getJobValidation(jobId)` → completionRequested, validatorApprovals, validatorDisapprovals, completionRequestedAt, disputedAt
- `getJobSpecURI(jobId)` → jobSpecURI
- `getJobCompletionURI(jobId)` → jobCompletionURI
- `getJobValidatorCount(jobId)` → number of validators who voted
- `getJobValidatorAt(jobId, index)` → validator address at index
- `getJobVote(jobId, validator)` → 0 (none), 1 (approved), 2 (disapproved)

## Indexers and UIs
If you previously hydrated rows via `jobs(jobId)`, call `getJobCore`, `getJobValidation`, the URI getters, and the validator helper getters above. Events remain the primary source of truth for changes over time; use these getters for point-in-time snapshots.
