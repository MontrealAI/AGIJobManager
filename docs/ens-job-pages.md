# ENS job pages (alpha.jobs.agi.eth)

This document defines the **official ENS naming scheme** and **record layout** for AGIJobManager job pages in the ALPHA environment. These records are **public pointers** only; they do **not** affect settlement or dispute logic.

## Naming convention (ALPHA)

One ENS name per job:

```
job-<jobId>.alpha.jobs.agi.eth
```

Where `jobId` is the on-chain `AGIJobManager` job ID.

Example:

```
job-42.alpha.jobs.agi.eth
```

## Ownership + delegation model (Model B)

### Ownership (platform-controlled namespace)
- **Owner of `alpha.jobs.agi.eth`**: the platform/operator (or a platform contract).
- **Owner of each `job-<jobId>` subname**: **platform-controlled** (typically a helper contract).

This keeps the namespace official and prevents spoofed job pages.

### Resolver authorization (employer + agent edits)
The platform owns the name but **delegates edit rights** in the ENS PublicResolver:
- **Employer** gets `setText` permissions on create.
- **Assigned agent** gets `setText` permissions on assignment.
- **Revocation** happens after terminal states to preserve receipt integrity.

The on-chain hooks only create the page and authorise the agent. Additional record syncing (e.g., completion pointers) uses the permissionless helper methods.

### Post-terminal locking (permissionless)
After completion/refund/expiry, anyone can call `ENSJobPages.lockJobENS(jobId, burnFuses)` to:
- Revoke resolver authorisations (best-effort).
- Optionally attempt NameWrapper fuse burning when wrapped.

> **Privacy rule**: ENS text records are public and immutable in history. Do **not** store secrets.

## ENS text record conventions (v1)

### Core keys (recommended)
| Key | Description |
| --- | --- |
| `schema` | `agijobmanager/v1` |
| `agijobs.jobId` | On-chain job ID |
| `agijobs.contract` | AGIJobManager contract address |
| `agijobs.employer` | Employer address |
| `agijobs.agent` | Assigned agent (empty until assigned) |
| `agijobs.state` | `CREATED|ASSIGNED|COMPLETION_REQUESTED|COMPLETED|REFUNDED|EXPIRED|CANCELLED|DISPUTED` |
| `agijobs.spec.public` | Public job spec URI |
| `agijobs.completion.public` | Public completion URI |

### Optional integrity keys
| Key | Description |
| --- | --- |
| `agijobs.spec.hash` | Integrity hash for the spec |
| `agijobs.completion.hash` | Integrity hash for the completion |

### Minimal defaults set by the platform (best-effort)
- `schema = agijobmanager/v1`
- `agijobs.spec.public = <jobSpecURI>`

To mirror completion pointers, call `ENSJobPages.mirrorCompletion(jobId)` after the completion request is recorded.

## Wrapped vs. unwrapped setup

### Unwrapped root (`alpha.jobs.agi.eth`)
- `ENSRegistry.owner(jobsRootNode)` is the platform contract.
- Create subnames with `ENSRegistry.setSubnodeRecord(...)`.

### Wrapped root
- `ENSRegistry.owner(jobsRootNode)` is `NameWrapper`.
- The platform contract must own the wrapped root **or** be approved via `isApprovedForAll`.
- Create subnames with `NameWrapper.setSubnodeRecord(...)`.

## Operational notes
- ENS integration is **best-effort only**. It must never block escrow, settlement, or dispute flows.
- Resolver authorisations are the official mechanism for employer/agent edits; ownership remains with the platform.
- `ENSJobPages.lockJobENS` and `ENSJobPages.mirrorCompletion` are permissionless helpers for post-state syncing.
- The `ENSJobPages` address is wired at deployment via the `ensConfig` tuple (or `AGI_ENS_JOB_PAGES` in deployment config).
