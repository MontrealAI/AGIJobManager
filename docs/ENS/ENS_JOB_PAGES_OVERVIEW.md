# ENS Job Pages Behavior Overview

This document describes ENS naming and hook behavior from the current on-chain contracts (`AGIJobManager` + `ENSJobPages`).

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

This imports/snapshots exact label, adopts or creates subname as needed, and applies best-effort resolver/auth/text updates.

---

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

---

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
