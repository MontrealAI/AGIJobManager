# ENS Job Pages Behavior Overview

This document describes ENS naming and hook behavior from the contracts currently in this repository (`AGIJobManager` + `ENSJobPages`).

---

## 1) Name composition: which contract controls each part

A job ENS name is composed from three sources:

- **Prefix source:** `ENSJobPages.jobLabelPrefix`.
- **Numeric id source:** AGIJobManager `jobId`.
- **Root suffix source:** `ENSJobPages.jobsRootName`.

Format:

```text
<jobLabelPrefix><jobId>.<jobsRootName>
```

Current default behavior:
- `jobLabelPrefix = "agijob"`
- mainnet deploy script default `jobsRootName = "alpha.jobs.agi.eth"`

Example names:
- `agijob0.alpha.jobs.agi.eth`
- `agijob1.alpha.jobs.agi.eth`

---

## 2) Prefix changes and label snapshot semantics

`ENSJobPages` snapshots the exact label when first created/imported for a job.

Operational implications:
- Changing `jobLabelPrefix` affects only unsnapshotted/future jobs.
- Snapshotted jobs keep their historical label permanently.

Practical read methods:
- `jobEnsLabel(jobId)` returns snapshotted label if present, else preview label from current prefix.
- `jobLabelSnapshot(jobId)` returns `(isSet, label)`.

Why this matters:
- Post-create write paths need deterministic node resolution from the snapshotted label.

---

## 3) Why legacy migration exists

Some older jobs predate the current ENSJobPages instance, so no snapshot exists in the new contract.

When this happens, write paths can fail with `JobLabelNotSnapshotted`.

Recovery function:
- `migrateLegacyWrappedJobPage(jobId, exactLabel)` (owner-only on ENSJobPages).

`exactLabel` must exactly match historical label for that `jobId`.

---

## 4) Wrapped root vs unwrapped root behavior

### Unwrapped root
- Root owner is directly in ENS registry.
- Subname creation uses registry `setSubnodeRecord` path.

### Wrapped root
- Root appears owned by NameWrapper.
- ENSJobPages requires authorization via NameWrapper (`ownerOf`, `getApproved`, or `isApprovedForAll`).
- Subname create/adopt uses wrapper `setSubnodeOwner` path.

Consistent terminology:
- **wrapped root** = root node owned by NameWrapper.
- **NameWrapper approval** = approval required so ENSJobPages can manage wrapped subnames.

---

## 5) Authorization and hook model

AGIJobManager sends lifecycle hooks to ENSJobPages using:
- `handleHook(hook, jobId)`

Hook updates (resolver/text/auth) are best-effort:
- protocol-critical AGIJobManager flow does not depend on ENS writes succeeding,
- ENSJobPages emits diagnostics (`ENSHookProcessed`, `ENSHookSkipped`, `ENSHookBestEffortFailure`).

Why this matters:
- ENS metadata issues should be remediated operationally without blocking escrow settlement.

---

## 6) Post-create write behavior and snapshot requirement

Write paths such as assignment/completion/revoke/lock resolve node from the stored snapshot label map.

If no snapshot exists for a legacy job in current ENSJobPages:
- node resolution fails,
- operations that depend on `_resolvedJobNodeForWrite` can revert with `JobLabelNotSnapshotted`.

Migration (`migrateLegacyWrappedJobPage`) is the intended operator recovery path.

---

## 7) Etherscan operator checks

On ENSJobPages `Read Contract`:
- `jobLabelPrefix`
- `jobsRootName`
- `jobsRootNode`
- `jobManager`
- `configLocked`
- `jobLabelSnapshot(jobId)`
- `jobEnsName(jobId)`

On AGIJobManager `Read Contract`:
- `ensJobPages`
- `useEnsJobTokenURI`

On NameWrapper `Read Contract`:
- `isApprovedForAll(rootOwner, ensJobPages)` where wrapped root is used.

---

## 8) Related operator docs

- ENS replacement and wiring: `../DEPLOYMENT/ENS_JOB_PAGES_MAINNET_REPLACEMENT.md`
- Deployment troubleshooting: `../TROUBLESHOOTING_DEPLOYMENT_AND_ENS.md`
- Official deploy flow: `../../hardhat/README.md`
