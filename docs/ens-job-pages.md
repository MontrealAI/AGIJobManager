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

The ALPHA root configuration is fixed:
- `jobsRootName = "alpha.jobs.agi.eth"`
- `jobsRootNode = namehash("alpha.jobs.agi.eth")`

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
> Prefer URIs, hashes, or encrypted blobs with off‑chain key exchange.

### Core keys (written by the platform, best‑effort)
| Key | Example | Description |
| --- | --- | --- |
| `schema` | `agijobmanager/v1` | Schema/version marker. |
| `agijobs.spec.public` | `ipfs://...` | Public job spec pointer (matches on‑chain `jobSpecURI`). |
| `agijobs.completion.public` | `ipfs://...` | Public completion pointer (matches on‑chain `jobCompletionURI`). |

### Optional integrity keys (recommended for operators)
| Key | Example | Description |
| --- | --- | --- |
| `agijobs.spec.hash` | `0x...` | Hash of the spec content (e.g., keccak256/SHA‑256). |
| `agijobs.completion.hash` | `0x...` | Hash of completion content. |
| `agijobs.jobId` | `42` | On‑chain job ID. |
| `agijobs.contract` | `0x...` | AGIJobManager address. |
| `agijobs.employer` | `0x...` | Employer address. |
| `agijobs.agent` | `0x...` | Assigned agent address (empty until assigned). |
| `agijobs.state` | `CREATED` | Current job state (see below). |

### Canonical job state labels
Use one of:
`CREATED`, `ASSIGNED`, `COMPLETION_REQUESTED`, `COMPLETED`, `REFUNDED`, `EXPIRED`, `CANCELLED`, `DISPUTED`.

## Auto‑mirrored records (on‑chain hooks)

When ENS job pages are configured, the platform attempts the following **best‑effort** mirrors:
- On **createJob**: `schema = agijobmanager/v1`, `agijobs.spec.public = <jobSpecURI>`.
- On **requestJobCompletion**: `agijobs.completion.public = <jobCompletionURI>`.
The platform also authorizes the employer on creation and the assigned agent on assignment, then revokes authorizations after terminal settlement.

> These mirrors and authorizations are **best‑effort** only; resolver/NameWrapper failures never block settlement.
> All other keys (e.g., `agijobs.jobId`, `agijobs.contract`, `agijobs.state`) are intentionally left for employers/agents to set via the PublicResolver once authorized.

## Wrapped vs unwrapped root setup

### Unwrapped root (`alpha.jobs.agi.eth`)
- ENS Registry owner of `alpha.jobs.agi.eth` is the platform contract (or ENS helper).
- Subnames are created via `ENSRegistry.setSubnodeRecord(...)`.

### Wrapped root (`alpha.jobs.agi.eth` wrapped)
- ENS Registry owner of `alpha.jobs.agi.eth` is NameWrapper.
- NameWrapper owner of the root must be the platform contract **or** must approve it via `setApprovalForAll`.
- Subnames are created via `NameWrapper.setSubnodeRecord(...)`.

### Operational ownership requirements (summary)
- **Unwrapped**: `ENSRegistry.owner(jobsRootNode)` must be `ENSJobPages` (or the configured controller).
- **Wrapped**: `ENSRegistry.owner(jobsRootNode)` must be `NameWrapper`, and the wrapped owner must be `ENSJobPages` **or** have approved it via `setApprovalForAll`.

## Resolver requirements
- `ENSJobPages` expects a PublicResolver that exposes `setAuthorisation(bytes32,address,bool)` and `setText(bytes32,string,string)`.
- Verify the resolver by calling `supportsInterface` off‑chain or inspecting the deployment’s ABI.

## ENSJobPages helper wiring (on-chain)

When using the `ENSJobPages` helper contract, complete these wiring steps in order:
1. Deploy `AGIJobManager` with correct ENS registry, NameWrapper, and root nodes (or call `setAddresses` before jobs are created).
2. Deploy `ENSJobPages` with the ENS registry, NameWrapper (if any), PublicResolver, root node, and root name.
3. Ensure `alpha.jobs.agi.eth` is owned by the helper (unwrapped) or wrapped and approved for it.
4. Call `ENSJobPages.setJobManager(AGIJobManager)` so hooks are accepted.
5. Call `AGIJobManager.setEnsJobPages(ENSJobPages)` to enable hook callbacks.
6. Optionally enable ENS-based completion NFT URIs via `AGIJobManager.setUseEnsJobTokenURI(true)`.
7. Optionally call `ENSJobPages.lockConfiguration()` after wiring is finalized.

These steps keep ENS integration **opt-in** and ensure lifecycle hooks remain best-effort.

### Best-effort vs guaranteed behavior under hook gas bounds

- `AGIJobManager` invokes `ENSJobPages.handleHook` with a bounded gas stipend.
- Critical ENS authorization checks and subname creation are **fail-closed** inside `ENSJobPages`.
- Resolver text writes and resolver authorisation updates are **best-effort** (`try/catch`).
- If the ENS hook path fails, `AGIJobManager` lifecycle actions remain live (job creation, assignment, settlement).
- Operators can always backfill large text records later using resolver-authorized wallets.

## Operator checklist
- Ensure the platform controls `alpha.jobs.agi.eth` and the configured PublicResolver.
- Ensure `ENSJobPages` is wired to `AGIJobManager` via `setJobManager` and `setEnsJobPages`.
- Ensure employer/agent wallets are authorized to edit text records via the resolver.
- Avoid secrets: use hashes or URIs only.
- Revoke resolver authorizations after terminal settlement.

## ENS job NFT tokenURI (optional)
When `AGIJobManager.setUseEnsJobTokenURI(true)` is enabled (and an ENS helper is configured), completion NFTs point to:
```
ens://job-<jobId>.alpha.jobs.agi.eth
```
When disabled (default), the tokenURI behavior is unchanged and continues to use the completion metadata pointer.

## Post‑terminal lock (optional)
`AGIJobManager.lockJobENS(jobId, burnFuses)` can be called after a terminal state to re‑revoke resolver authorizations and optionally attempt fuse burning (best‑effort).
If the job was cancelled or delisted (and the job struct is cleared), the lock hook can still attempt fuse burning but may not have access to employer/agent addresses; authorizations were already revoked during terminalization.
When `burnFuses` is true and the name is wrapped, `ENSJobPages` attempts to burn only:
- `CANNOT_SET_RESOLVER`
- `CANNOT_SET_TTL`

These minimal fuses prevent resolver/TTL changes without burning all fuses, reducing the risk of accidental lockouts.
Fuse burning is optional and does **not** affect settlement or withdrawals if it fails.
