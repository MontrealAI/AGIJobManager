# ENS Job Pages Behavior Overview

Primary source of truth: `contracts/ens/ENSJobPages.sol` and AGIJobManager ENS hook calls in `contracts/AGIJobManager.sol`.

## 1) What determines each part of a job ENS name

Job ENS names are composed as:

`<labelPrefix><jobId>.<jobsRootName>`

- **Prefix source:** `ENSJobPages.jobLabelPrefix` (default `agijob`).
- **Numeric job ID source:** AGIJobManager lifecycle (`jobId` passed via hooks).
- **Root suffix source:** `ENSJobPages.jobsRootName` (configured root, e.g. `alpha.jobs.agi.eth`).

Default examples with current defaults:

- `agijob0.alpha.jobs.agi.eth`
- `agijob1.alpha.jobs.agi.eth`

## 2) Prefix behavior and snapshot semantics

`jobLabelPrefix` can be changed by owner using `setJobLabelPrefix(newPrefix)` while config is unlocked.

Important behavior:

- Prefix changes affect only jobs without a snapshotted label.
- Once a job label is snapshotted/imported, it is preserved for that job.
- Post-create write paths require snapshotted labels.

Why this matters:

- Historical jobs keep stable names.
- Operators can change future naming policy without breaking old job names.

## 3) Wrapped vs unwrapped root behavior

ENSJobPages supports both modes:

### Wrapped root

- Root owner at ENS registry is `NameWrapper`.
- ENSJobPages needs wrapper authorization (direct owner, per-token approval, or `setApprovalForAll`).
- Subname create/adopt uses NameWrapper route.

### Unwrapped root

- ENS root owner must be ENSJobPages contract directly.
- Subname create uses direct ENS registry `setSubnodeRecord` route.

## 4) Authorization model for job pages

On create/assign/revoke/lock flows, ENSJobPages attempts resolver authorization updates:

- employer authorization enabled on create,
- agent authorization enabled on assign,
- both authorization entries revoked on revoke/lock.

Resolver writes are best-effort:

- failures emit `ENSHookBestEffortFailure`,
- AGIJobManager settlement/lifecycle flow is intentionally not reverted by these resolver-side failures.

## 5) Hook model and best-effort semantics

AGIJobManager calls `ENSJobPages.handleHook(hook, jobId)` with known hook IDs.

ENSJobPages then:

1. reads job data from AGIJobManager view functions,
2. attempts ENS and resolver writes in `try/catch`,
3. emits hook outcome events (`ENSHookProcessed`, `ENSHookSkipped`, optional best-effort failure events).

Practical operator takeaway:

- ENS integration is additive UX/identity metadata.
- Failed ENS side effects do not imply escrow corruption.

## 6) Legacy migration behavior

For old job labels (especially wrapped roots), operator can call:

- `migrateLegacyWrappedJobPage(jobId, exactLabel)`

This function:

- imports the exact historical label for `jobId`,
- adopts an existing node if possible (or creates one),
- reapplies resolver/auth/text values best-effort.

Use this when a legacy job later needs write-hook updates but label was never snapshotted in the current ENSJobPages deployment.

## 7) Quick operator checks (Etherscan)

Read from ENSJobPages:

- `jobLabelPrefix()`
- `jobsRootName()`
- `jobManager()`
- `jobEnsLabel(jobId)`
- `jobLabelSnapshot(jobId)`
- `jobEnsName(jobId)`

Read from AGIJobManager:

- `ensJobPages()`

Read from NameWrapper:

- `isApprovedForAll(wrappedRootOwner, ensJobPagesAddress)`

These checks are the fastest way to confirm naming behavior, wiring, and wrapped-root authorization state.
