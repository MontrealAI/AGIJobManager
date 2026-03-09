# ENS Job Pages Behavior Overview

This document describes ENS naming and hook behavior from the current on-chain contracts (`AGIJobManager` + `ENSJobPages`).

## In one minute
- Canonical name shape is `<prefix><jobId>.<jobsRootName>`.
- Defaults are `prefix=agijob`, `jobsRootName=alpha.jobs.agi.eth`, so names look like `agijob0.alpha.jobs.agi.eth`.
- Settlement and dispute progression live in `AGIJobManager`; ENS writes in `ENSJobPages` are best-effort and non-fatal to settlement.
- Legacy jobs may need explicit snapshot migration to avoid `JobLabelNotSnapshotted` write failures.

---


## Canonical defaults used in current operator docs
- `jobLabelPrefix = agijob`
- `jobsRootName = alpha.jobs.agi.eth`
- Example names: `agijob0.alpha.jobs.agi.eth`, `agijob1.alpha.jobs.agi.eth`

If your deployment uses different values, update your runbooks so operators still reason using the same `<prefix><jobId>.<jobsRootName>` model.

---

## 1) Name composition: who controls what

For a given job ENS name, each component comes from a different source:

- **Prefix source:** `ENSJobPages.jobLabelPrefix` (default set in constructor: `"agijob"`).
- **Numeric id source:** `AGIJobManager` job id (`jobId`).
- **Root suffix source:** `ENSJobPages.jobsRootName`.

Effective name format:

```text
<jobLabelPrefix><jobId>.<jobsRootName>
```

Example with defaults:
- `agijob0.alpha.jobs.agi.eth`
- `agijob1.alpha.jobs.agi.eth`

---

## 2) Snapshot behavior and prefix changes

`ENSJobPages` snapshots the exact label when a job page is first created/imported.

Implications:
- Changing `jobLabelPrefix` only affects **unsnapshotted** jobs (future/preview labels).
- Already snapshotted jobs keep their historical exact label permanently.

Operationally:
- `jobEnsLabel(jobId)` returns snapshotted label if present; otherwise preview label from current prefix.
- Post-create write paths require a snapshotted label for deterministic node resolution.

---

## 3) Why some legacy jobs need migration

Write paths (`onAgentAssigned`, `onCompletionRequested`, `revokePermissions`, `lockJobENS`) resolve nodes via the snapshotted label map.

If a job predates the current ENSJobPages deployment and label was never imported/snapshotted, writes can fail with `JobLabelNotSnapshotted`.

Recovery path:
- Owner calls `migrateLegacyWrappedJobPage(jobId, exactLabel)`.

What this migration is for:
- snapshots the exact historical label for deterministic node resolution,
- adopts existing wrapped child if parent-controllable, or creates when needed,
- applies resolver/auth/text updates on a best-effort basis.

If a wrapped child is no longer parent-controllable (for example, emancipated), migration adoption can fail and revert (`ENSNotAuthorized`) rather than partially succeeding.

---

## 3.1) Why old create hooks failed in some deployments

In replacement scenarios, historical jobs can fail post-create ENS writes because the new ENSJobPages does not automatically know old exact labels.

Typical root causes:
- missing label snapshot for a legacy job in the new contract,
- missing wrapped-root approval for the active ENSJobPages operator,
- AGIJobManager still pointing to an old ENSJobPages address.

The replacement flow addresses this by cutover wiring plus per-job legacy migration when needed.

## 4) Wrapped root vs unwrapped root behavior

### Unwrapped root
- ENSJobPages expects direct ENS ownership of `jobsRootNode`.
- Subname creation uses ENS registry `setSubnodeRecord`.

### Wrapped root
- Root owner appears as NameWrapper.
- ENSJobPages requires wrapper authorization (`ownerOf`, `getApproved`, or `isApprovedForAll`) before wrapped operations.
- Subname create/adopt uses NameWrapper `setSubnodeOwner`.

Operational term consistency:
- **wrapped root** = root node owned by NameWrapper.
- **NameWrapper approval** = approvals needed so ENSJobPages can manage wrapped root/subnames.

---

## 5) Authorization model for job pages

ENSJobPages tries to set resolver authorizations for employer/agent at lifecycle points:
- create: authorize employer,
- assign: authorize assigned agent,
- revoke/lock: de-authorize employer/agent.

For migration it computes `allowAuth` from AGIJobManager core state:
- keeps auth if unresolved,
- revokes only for terminal completion/expiry conditions.

---

## 6) Hook model and best-effort semantics

AGIJobManager calls ENS hooks through `ensJobPages.handleHook(hook, jobId)` with bounded gas.

Important semantics:
- Hook invocation is non-blocking for AGIJobManager settlement flow.
- ENSJobPages itself uses `try/catch` and emits:
  - `ENSHookProcessed`
  - `ENSHookSkipped`
  - `ENSHookBestEffortFailure`
- Resolver/text/authorization updates are best-effort and may fail without reverting protocol-critical AGIJobManager flow.

Why this matters:
- ENS metadata should not halt escrow settlement.
- Operators must monitor ENS events and correct configuration issues separately.

### Why best-effort is intentional
AGIJobManager is the source of truth for escrow, dispute, and payout outcomes. ENS is an auxiliary metadata/indexing layer. Keeping ENS hook failures non-fatal prevents resolver/wrapper outages from blocking protocol settlement.

---


## 6.1) Expected behavior after cutover

- **Future/unsnapshotted jobs:** use the active prefix and root (`<prefix><jobId>.<jobsRootName>`), then snapshot on create/import.
- **Legacy snapshotted jobs:** keep historical exact labels; they do not auto-rename when prefix changes.
- **Legacy unsnapshotted jobs in replacement contract:** may require `migrateLegacyWrappedJobPage(jobId, exactLabel)` before deterministic post-create writes succeed.

## 7) Practical operator checks on Etherscan

On ENSJobPages `Read Contract`:
- `jobLabelPrefix`
- `jobsRootName`
- `jobsRootNode`
- `jobManager`
- `configLocked`

For a given job:
- `jobLabelSnapshot(jobId)` to confirm whether label exists.
- `jobEnsName(jobId)` for effective name string.

On AGIJobManager `Read Contract`:
- `ensJobPages`
- `useEnsJobTokenURI`

---

## 8) Related runbooks

- ENS replacement and wiring: `../DEPLOYMENT/ENS_JOB_PAGES_MAINNET_REPLACEMENT.md`
- Deployment troubleshooting: `../TROUBLESHOOTING_DEPLOYMENT_AND_ENS.md`
- Official deploy guide: `../../hardhat/README.md`
