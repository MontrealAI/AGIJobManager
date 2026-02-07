# ENS job pages (ALPHA environment)

This document defines the **official ENS job page** conventions for AGIJobManager in the ALPHA namespace. Job pages are **platform‑owned** and **delegated** to employers + agents via resolver authorisations. ENS data is public; store **only** public pointers and hashes.

## Naming scheme (official namespace)

**Root:** `alpha.jobs.agi.eth`

**Per‑job name:**
```
job-<jobId>.alpha.jobs.agi.eth
```

Example:
```
job-42.alpha.jobs.agi.eth
```

`jobId` is the on‑chain AGIJobManager jobId.

## Ownership + delegation model (Model B)

- **Root owner:** the platform (AGIJobManager or ENSJobPages helper).
- **Per‑job owner:** the platform (contract‑controlled), not the employer.
- **Employer + assigned agent:** granted resolver write permission via `PublicResolver.setAuthorisation`.

This keeps the namespace official while enabling employer/agent updates without transferring ENS ownership.

### Post‑terminal locking (optional)
After completion/refund/expiry/cancel/delist, the platform **revokes resolver authorisations** for employer + agent. An optional post‑terminal `lockJobENS(jobId, burnFuses)` can re‑revoke permissions and (optionally) burn fuses when the name is wrapped. Fuse burning is best‑effort and never affects settlement.

## ENS text record conventions

> **Privacy rule:** ENS text records are public. Do **not** store secrets or private material.

## ENSJobPages helper (on-chain operator)

The repository includes an `ENSJobPages` helper contract that can create job subnames, set resolver permissions, and mirror public pointers. It is intended to be called by a platform operator or wired into an on-chain hook once bytecode size constraints permit.

**Standard keys** (recommended for indexers + validators):

| Key | Example value | Notes |
| --- | --- | --- |
| `schema` | `agijobmanager/v1` | Schema marker |
| `agijobs.jobId` | `"42"` | Job id (decimal) |
| `agijobs.contract` | `0x...` | AGIJobManager address |
| `agijobs.employer` | `0x...` | Employer wallet |
| `agijobs.agent` | `0x...` | Agent wallet (empty until assigned) |
| `agijobs.state` | `CREATED` | `CREATED|ASSIGNED|COMPLETION_REQUESTED|COMPLETED|REFUNDED|EXPIRED|CANCELLED|DISPUTED` |
| `agijobs.spec.public` | `ipfs://...` | Public job spec pointer |
| `agijobs.completion.public` | `ipfs://...` | Public completion pointer |

**Optional integrity helpers** (hash‑only is privacy‑friendly):
- `agijobs.spec.hash`
- `agijobs.completion.hash`

### Contract‑set fields (best‑effort)
The ENS integration may **best‑effort** set small text records:
- On create: `schema = agijobmanager/v1`
- On create: `agijobs.spec.public = <jobSpecURI>`
- On completion request: `agijobs.completion.public = <jobCompletionURI>`

These updates never block settlement or disputes.

## Wrapped vs unwrapped root operations

**Unwrapped root** (`ENSRegistry.owner(root) == AGIJobManager/ENSJobPages`):
- Use `ENSRegistry.setSubnodeRecord(root, label, owner, resolver, ttl)`.

**Wrapped root** (`ENSRegistry.owner(root) == NameWrapper`):
- Ensure the wrapper owner is the platform or has approved it via `isApprovedForAll`.
- Use `NameWrapper.setSubnodeRecord(root, label, owner, resolver, ttl, fuses=0, expiry=max)`.

## How employers/agents update records
Once authorised, employer/agent wallets can write text records with:
```
PublicResolver.setText(node, key, value)
```

Where `node` is the namehash of `job-<jobId>.alpha.jobs.agi.eth`.

## Notes for indexers + UIs
- ENS is an authoritative **pointer** layer, not the on‑chain source of truth.
- UIs should fetch the referenced spec/completion JSON and render a human‑readable page.
- Avoid secrets: ENS records are permanent and globally visible.
