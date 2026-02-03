# Contract read API (job getters)

## Why `jobs` is internal
The `jobs` mapping is now `internal` to avoid the legacy Solidity codegen stack-too-deep error without enabling `viaIR`. This removes the giant auto-generated tuple getter from the ABI while keeping job lifecycle behavior unchanged.

## Read getters for jobs
Use the targeted read functions below instead of `jobs(jobId)`:

- `getJobCore(jobId)` → employer, assignedAgent, payout, duration, assignedAt, completed, disputed, expired, agentPayoutPct
- `getJobValidation(jobId)` → completionRequested, validatorApprovals, validatorDisapprovals, completionRequestedAt, disputedAt
- `getJobURIs(jobId)` → jobSpecURI, jobCompletionURI, ipfsHash, details

## Indexers and UIs
If you previously hydrated rows via `jobs(jobId)`, call `getJobCore`, `getJobValidation`, and `getJobURIs`. Events remain the primary source of truth for changes over time (including validators via `JobValidated`/`JobDisapproved`); use these getters for point-in-time snapshots.
