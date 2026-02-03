# Contract read API (jobs)

## Why `jobs` is internal

`jobs` is now `internal` to prevent Solidity from generating a large tuple-returning getter that can trigger **“stack too deep”** under the legacy codegen pipeline (without `viaIR`). This keeps compilation stable while preserving read access through smaller, targeted view functions.

## Read accessors

Use the following external view functions instead of `jobs(jobId)`:

- `getJobCore(jobId)` → `employer`, `assignedAgent`, `payout`, `duration`, `assignedAt`, `completed`, `disputed`, `expired`, `agentPayoutPct`
- `getJobValidation(jobId)` → `completionRequested`, `validatorApprovals`, `validatorDisapprovals`, `completionRequestedAt`, `disputedAt`
- `getJobURIs(jobId)` → `jobSpecURI`, `jobCompletionURI`, `ipfsHash`, `details`
- `getJobValidatorCount(jobId)` → validator array length
- `getJobValidatorAt(jobId, index)` → validator address at index

Each getter reverts with `JobNotFound` if the job does not exist (via the shared `_job(jobId)` helper).

## Indexers / UIs

Direct `jobs(jobId)` access is no longer part of the ABI. Use the getters above alongside events (`JobCreated`, `JobApplied`, `JobCompletionRequested`, `JobValidated`, `JobDisapproved`, `JobCompleted`, `JobDisputed`, `JobCancelled`, `JobExpired`, `JobFinalized`, `DisputeResolved`, `DisputeResolvedWithCode`) to hydrate job state.
