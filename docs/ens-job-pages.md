# ENS “Job Page” conventions (ALPHA namespace)

This document defines the **official ENS naming scheme** and **record layout** for job pages under the ALPHA root namespace. These records are **public** and **indexer‑friendly**; they are designed to be a lightweight mirror of on‑chain pointers.

## Naming convention (official ALPHA namespace)

One ENS name per job:

```
job-<jobId>.alpha.jobs.agi.eth
```

Example:
```
job-42.alpha.jobs.agi.eth
```

`jobId` is the on‑chain AGIJobManager job ID.

## Ownership + delegation model (Model B)

### Ownership
- **Owner of `alpha.jobs.agi.eth`**: the AGIJobManager platform (or its ENS helper contract).
- **Owner of each job subname**: the platform (contract‑controlled), **not** the employer.

This keeps the namespace official and prevents spoofed job pages while still allowing delegated edits.

### Resolver authorization (employer + agent edits)
- The platform sets a PublicResolver for each job subname.
- The platform **authorizes** the employer and the assigned agent to edit records via `setAuthorisation`.
- After terminal settlement, the platform **revokes** resolver authorizations (best‑effort).

### Optional post‑terminal lock
If the job subname is wrapped (ENS NameWrapper), the platform may attempt fuse burning after terminal states. This is optional and **best‑effort** only; settlement never depends on fuse behavior.
Anyone can also call `AGIJobManager.lockJobENS(jobId, burnFuses)` after a job is terminal to revoke authorizations again and optionally attempt fuse burning (best‑effort).

## ENS record conventions

> **Privacy warning**: ENS text records are public and immutable in history. Do **not** store secrets.

### Core keys (recommended)
| Key | Example | Description |
| --- | --- | --- |
| `schema` | `agijobmanager/v1` | Schema/version marker. |
| `agijobs.jobId` | `42` | On‑chain job ID. |
| `agijobs.contract` | `0x...` | AGIJobManager address. |
| `agijobs.employer` | `0x...` | Employer address. |
| `agijobs.agent` | `0x...` | Assigned agent address (empty until assigned). |
| `agijobs.state` | `CREATED` | Current job state (see below). |
| `agijobs.spec.public` | `ipfs://...` | Public job spec pointer (matches on‑chain `jobSpecURI`). |
| `agijobs.completion.public` | `ipfs://...` | Public completion pointer (matches on‑chain `jobCompletionURI`). |

### Optional integrity keys (privacy‑friendly)
| Key | Example | Description |
| --- | --- | --- |
| `agijobs.spec.hash` | `0x...` | Hash of the spec content (e.g., keccak256/SHA‑256). |
| `agijobs.completion.hash` | `0x...` | Hash of completion content. |

### Canonical job state labels
Use one of:
`CREATED`, `ASSIGNED`, `COMPLETION_REQUESTED`, `COMPLETED`, `REFUNDED`, `EXPIRED`, `CANCELLED`, `DISPUTED`.

## Auto‑mirrored records (on‑chain hooks)

When ENS job pages are configured, the platform attempts the following **best‑effort** mirrors:
- On **createJob**: `schema = agijobmanager/v1`, `agijobs.spec.public = <jobSpecURI>`.
- On **requestJobCompletion**: `agijobs.completion.public = <jobCompletionURI>`.
The platform also authorizes the employer on creation and the assigned agent on assignment, then revokes authorizations after terminal settlement.

> These mirrors are **best‑effort** only; ENS failures never block settlement.

## Wrapped vs unwrapped root setup

### Unwrapped root (`alpha.jobs.agi.eth`)
- ENS Registry owner of `alpha.jobs.agi.eth` is the platform contract (or ENS helper).
- Subnames are created via `ENSRegistry.setSubnodeRecord(...)`.

### Wrapped root (`alpha.jobs.agi.eth` wrapped)
- ENS Registry owner of `alpha.jobs.agi.eth` is NameWrapper.
- NameWrapper owner of the root must be the platform contract (or approve it via `isApprovedForAll`).
- Subnames are created via `NameWrapper.setSubnodeRecord(...)`.

## Operator checklist
- Ensure the platform controls `alpha.jobs.agi.eth` and the configured PublicResolver.
- Ensure employer/agent wallets are authorized to edit text records via the resolver.
- Avoid secrets: use hashes or URIs only.
- Revoke resolver authorizations after terminal settlement.

## ENS job NFT tokenURI (optional)
When `AGIJobManager.setUseEnsJobTokenURI(true)` is enabled (and an ENS helper is configured), completion NFTs point to:
```
ens://job-<jobId>.alpha.jobs.agi.eth
```
When disabled (default), the tokenURI behavior is unchanged and continues to use the completion metadata pointer.
