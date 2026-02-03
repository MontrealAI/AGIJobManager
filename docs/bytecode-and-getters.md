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
(a safety margin under the 24,576 byte EIP-170 limit). Tests also guard the
`TestableAGIJobManager` wrapper when it is compiled for local suites.

After compiling, run:

```bash
npm run size
```

This reads `build/contracts/AGIJobManager.json` by default (or any contracts
listed via `BYTECODE_CONTRACTS`) and prints the runtime byte length. CI and the
Truffle test guard enforce the same limit for `AGIJobManager` and
`TestableAGIJobManager` artifacts.

Current measured sizes from the latest build (Solidity 0.8.19, runs=50):
- `AGIJobManager`: **24295 bytes**
- `TestableAGIJobManager`: **24545 bytes**

## Compiler configuration
`viaIR` remains **OFF** in `truffle-config.js`. The repo pins Solidity
**0.8.19** (override with `SOLC_VERSION` only if needed) to avoid the
OpenZeppelin `memory-safe-assembly` deprecation warnings while staying
compatible with the current OZ 4.x dependencies. Optimizer runs default to
**50**; if you adjust this, ensure the bytecode limit tests still pass.

## OpenZeppelin warning background
Newer Solidity releases emit deprecation warnings for the legacy
`@solidity memory-safe-assembly` natspec comment used in OpenZeppelin 4.x. We
pin a compatible Solidity release in Truffle to keep the compile output clean
without modifying `node_modules`.
