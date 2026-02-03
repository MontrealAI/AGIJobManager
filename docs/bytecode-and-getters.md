# Bytecode size & job getters

## Why `jobs` is internal
The `Job` struct is large and contains mappings/arrays. Exposing a public
`jobs(jobId)` getter risks Solidity stack-too-deep compilation failures and
creates an oversized ABI tuple. To keep compilation stable (with `viaIR` OFF),
`jobs` is kept `internal` and callers should use the smaller read-model getters
instead.

## Read-model getters to use
Use the targeted view functions that return only the fields needed for UI/tests:

- `getJobCore(jobId)` → employer, assignedAgent, payout, duration, assignedAt,
  completed, disputed, expired, agentPayoutPct.
- `getJobValidation(jobId)` → completionRequested, validatorApprovals,
  validatorDisapprovals, completionRequestedAt, disputedAt.
- `getJobSpecURI(jobId)` → jobSpecURI.
- `getJobCompletionURI(jobId)` → jobCompletionURI.

These functions use `_job(jobId)` internally so they revert with `JobNotFound`
when the job is missing.

## Runtime bytecode size check (EIP-170)
The deployed/runtime bytecode of `AGIJobManager` must remain **≤ 24575 bytes**
(a safety margin under the 24,576 byte EIP-170 limit).

After compiling, run:

```bash
npm run size
```

This reads `build/contracts/AGIJobManager.json` and prints the runtime byte
length. CI also enforces the same limit.

## Compiler configuration
`viaIR` remains **OFF** in `truffle-config.js`. Optimizer runs are pinned low
(`runs=1`) to keep runtime bytecode under the EIP‑170 safety margin; if you
adjust this, ensure the bytecode limit test still passes.
