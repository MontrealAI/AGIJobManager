# ENSJobPages Contract Reference

## Purpose
`ENSJobPages` manages per-job ENS records and optional ENS-based tokenURI output for AGIJobManager completion NFTs.

## Responsibilities
- Create `job-<id>.<jobsRootName>` subnames.
- Write text records (`schema`, `agijobs.spec.public`, `agijobs.completion.public`) best-effort.
- Manage resolver authorizations for employer/agent.
- Revoke permissions at settlement and optionally burn lock fuses.

## Roles
- **Owner**: direct admin and manual hook helpers (`createJobPage`, `onAgentAssigned`, `onCompletionRequested`, `revokePermissions`, `lockJobENS`).
- **Job manager**: `handleHook` caller restricted by `onlyJobManager`.

## Hook mapping (`handleHook`)
- `1`: create job page from `getJobSpecURI` + employer.
- `2`: authorize assigned agent.
- `3`: write completion URI text.
- `4`: revoke employer/agent permissions.
- `5`: lock permissions.
- `6`: lock + attempt fuse burn.

## Best-effort behavior
- `setText` and `setAuthorisation` calls are wrapped in `try/catch`; failures do not revert.
- Fuse burning occurs only when root is wrapped and authorization checks pass.

## Key config
- `setENSRegistry`, `setNameWrapper`, `setPublicResolver`, `setJobsRoot`, `setJobManager`, `setUseEnsJobTokenURI`.
- `jobEnsURI(jobId)` returns `ens://job-<id>.<root>`.

## Operational assumptions
- For wrapped roots, contract must own wrapper token or be approved-for-all by wrapped owner.
- For unwrapped roots, ENS owner of root node must be this contract.
