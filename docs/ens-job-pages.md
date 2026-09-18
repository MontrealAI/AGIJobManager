# ENS job-page naming and records

This document describes the configurable naming scheme and public record layout for ENS job pages. Fresh USDC deployments require a dedicated namespace and helper. Preserve the legacy `alpha.jobs.agi.eth` root and its existing manager/helper/jobs. The examples use the fork-rehearsed proposal `usdc-v095.alpha.jobs.agi.eth`, which is not a live deployment; see the [cutover qualification](qualification/USDC_CUTOVER.md).

## Configured naming convention

One ENS name per job:

```
agijob<jobId>.usdc-v095.alpha.jobs.agi.eth
```

Example:
```
agijob42.usdc-v095.alpha.jobs.agi.eth
```

`jobId` is the on‑chain AGIJobManager job ID.

`jobLabelPrefix` defaults to `agijob`; the root is explicit. The proposal is:
- `jobsRootName = "usdc-v095.alpha.jobs.agi.eth"`
- `jobsRootNode = namehash("usdc-v095.alpha.jobs.agi.eth")`

## Ownership + delegation model (Model B)

### Ownership
- **Owner of `usdc-v095.alpha.jobs.agi.eth`**: the AGIJobManager platform (or its ENS helper contract).
- **Owner of each job subname**: the platform (contract‑controlled), **not** the employer.

This keeps the namespace official and prevents spoofed job pages while still allowing delegated edits.

### Resolver authorization (employer + agent edits)
- The platform sets a PublicResolver for each job subname.
- The platform **authorizes** the employer and the assigned agent to edit records via `approve(bytes32,address,bool)`.
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

Ownership of the dedicated **wrapped-root token** by the helper is the qualified fresh-USDC route: Registry owner is NameWrapper and wrapper token owner is the helper. A same-manager wrapped-root replacement needs separate authority review; `setApprovalForAll` affects every wrapped name of the approving account.

### Separately configured unwrapped root
- ENS Registry owner of the configured root is the ENS helper. This is supported behavior but is not the dedicated wrapped-root fixture’s ownership model.
- Subnames are created via `ENSRegistry.setSubnodeRecord(...)`.

### Wrapped root (`usdc-v095.alpha.jobs.agi.eth` wrapped)
- ENS Registry owner of `usdc-v095.alpha.jobs.agi.eth` is NameWrapper.
- NameWrapper owner of the root must be the platform contract **or** must approve it via `setApprovalForAll`.
- Subnames are created via `NameWrapper.setSubnodeOwner(...)`.

### Operational ownership requirements (summary)
- **Unwrapped**: `ENSRegistry.owner(jobsRootNode)` must be `ENSJobPages` (or the configured controller).
- **Wrapped**: `ENSRegistry.owner(jobsRootNode)` must be `NameWrapper`, and the wrapped owner must be `ENSJobPages` **or** have approved it via `setApprovalForAll`.

## Resolver requirements
- `ENSJobPages` expects a PublicResolver that exposes `approve(bytes32,address,bool)` and `setText(bytes32,string,string)`.
- Verify the resolver by calling `supportsInterface` off‑chain or inspecting the deployment’s ABI.

## ENSJobPages helper wiring (on-chain)

When using the `ENSJobPages` helper contract, complete these wiring steps:
1. Deploy `ENSJobPages` with the ENS registry, NameWrapper (if any), PublicResolver, root node, and root name.
2. Have the parent owner create the reviewed dedicated wrapped root with the new helper as its wrapped-token owner. Verify Registry owner is NameWrapper and `NameWrapper.ownerOf(root)` is the helper. No new token or blanket operator approval is required for the qualified route.
3. Call `ENSJobPages.setJobManager(AGIJobManager)` so hooks are accepted.
4. Call `AGIJobManager.setEnsJobPages(ENSJobPages)` to enable hook callbacks.

These steps keep ENS integration **opt-in** and ensure lifecycle hooks remain best-effort.

## Operator checklist
- Ensure the platform controls `usdc-v095.alpha.jobs.agi.eth` and the configured PublicResolver.
- Ensure `ENSJobPages` is wired to `AGIJobManager` via `setJobManager` and `setEnsJobPages`.
- Ensure employer/agent wallets are authorized to edit text records via the resolver.
- Avoid secrets: use hashes or URIs only.
- Revoke resolver authorizations after terminal settlement.

## ENS job NFT tokenURI (optional)
When `AGIJobManager.setUseEnsJobTokenURI(true)` is enabled (and an ENS helper is configured), completion NFTs point to:
```
ens://agijob<jobId>.usdc-v095.alpha.jobs.agi.eth
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
