# ENS Job Pages Behavior Overview

This document describes ENS naming and hook behavior in the repository contracts (`AGIJobManager` + `ENSJobPages`) and current deployment tooling. Historical deployments retain their own configuration.

## In one minute
- Canonical name shape is `<prefix><jobId>.<jobsRootName>`.
- Fresh deployment tooling sets prefix `job-` and derives a root from the chain ID and full manager address. The Solidity constructor still defaults to `agijob`. See the [namespace policy and historical names](DEPLOYMENT_NAMESPACES.md).
- Settlement and dispute progression live in `AGIJobManager`; ENS writes in `ENSJobPages` are best-effort and non-fatal to settlement.
- Legacy jobs may need explicit snapshot migration to avoid `JobLabelNotSnapshotted` write failures.

---


## Naming used in the qualified fork

- `jobLabelPrefix = job-`
- Mainnet root: `usdc-1-<full-lowercase-manager-address-without-0x>.alpha.jobs.agi.eth`
- Names: `job-0.<derived-root>`, `job-1.<derived-root>`

Angle-bracket values are placeholders. The [machine report](../qualification/mainnet-cutover.json) records the actual synthetic manager and root exercised locally; do not copy those addresses into a live deployment. The deployment script derives the root from your manager and checks availability. Same-manager helper replacement preserves the existing root and prefix.

---

## 1) Name composition: who controls what

For a given job ENS name, each component comes from a different source:

- **Prefix source:** `ENSJobPages.jobLabelPrefix` (constructor: `"agijob"`; maintained fresh-deployment script: `"job-"`).
- **Numeric id source:** `AGIJobManager` job id (`jobId`).
- **Root suffix source:** `ENSJobPages.jobsRootName`.

Effective name format:

```text
<jobLabelPrefix><jobId>.<jobsRootName>
```

For fresh deployments, use the script's printed `firstJobName` to review the concrete name. For existing jobs, read `jobEnsName(jobId)` from the associated helper instead of assuming the current default prefix was used historically.

---

## 2) Snapshot behavior and prefix changes

`ENSJobPages` snapshots the exact label when a job page is first created/imported.

Implications:
- Changing `jobLabelPrefix` only affects **unsnapshotted** jobs (future/preview labels).
- Already snapshotted jobs keep their historical exact label across prefix changes. The root is separate global configuration and remains owner-changeable until configuration is locked; a label snapshot alone does not freeze the full name.

Operationally:
- `jobEnsLabel(jobId)` returns snapshotted label if present; otherwise preview label from current prefix.
- Post-create write paths require a snapshotted label for deterministic node resolution.

---

## 3) Why existing pages may need same-manager helper migration

This applies only to pages of the same manager when replacing its helper. A fresh USDC manager must preserve the original mainnet manager’s pages and wiring and use a separate namespace.

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
- Observe `tokenURI(tokenId)` and the reviewed `setUseEnsJobTokenURI` action; the private flag has no public getter.

---

## 8) Related runbooks

- ENS replacement and wiring: `../DEPLOYMENT/ENS_JOB_PAGES_MAINNET_REPLACEMENT.md`
- Deployment troubleshooting: `../TROUBLESHOOTING_DEPLOYMENT_AND_ENS.md`
- Official deploy guide: `../../hardhat/README.md`
