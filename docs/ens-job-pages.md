# ENS “Job Page” conventions (ALPHA namespace)

This document defines the **official ENS naming scheme** and **record layout** for job pages under the `alpha.jobs.agi.eth` namespace. These conventions are **off‑chain** and **indexer‑friendly**; they do not change contract behavior.

## Naming convention (official namespace)

Use one ENS name per job in the ALPHA environment:

```
job-<jobId>.alpha.jobs.agi.eth
```

Example:
```
job-42.alpha.jobs.agi.eth
```

## Ownership and delegation model

### Ownership (recommended)
- **Owner of `alpha.jobs.agi.eth`**: the AGI.Eth operator (or platform owner). This keeps the namespace official and prevents spoofed job pages.
- **Per‑job subdomain owner**: the platform (or a registrar/helper contract). Ownership stays with the operator for integrity.

### Resolver authorization (how employers + agents edit)
- The platform keeps subdomain ownership but **authorizes** edits via resolver permissions.
- Employer + assigned agent receive edit rights to update job spec and completion records.
- Validators read records; they do not need edit rights.

**Typical pattern**
1. Platform creates `job-<jobId>.alpha.jobs.agi.eth` and sets a resolver.
2. Resolver allows specific accounts (employer + agent) to call `setText` / `setContenthash`.
3. Platform revokes write access after completion (optional).

### Optional record locking after completion
- After settlement, the resolver can **freeze** records to preserve receipt integrity.
- Locking is resolver‑dependent (e.g., NameWrapper fuses or resolver access control). Treat this as optional and document your chosen mechanism.
 - Completion records can be updated directly by authorized employers/agents; on-chain hooks only set the initial schema/spec pointers by default.

### Wrapped vs unwrapped root setup
- **Unwrapped `alpha.jobs.agi.eth`**: the platform contract (or ENS helper) must be the ENS registry owner and can call `ENSRegistry.setSubnodeRecord` to create `job-<id>` subnames.
- **Wrapped `alpha.jobs.agi.eth`**: the ENS registry owner is the NameWrapper; the platform contract (or helper) must be the wrapped owner or an approved operator and should call `NameWrapper.setSubnodeRecord`.
- Fuse burning is optional; ensure settlement flows never depend on fuse changes.

## ENS record layout

> **Privacy rule**: ENS text records are public. Do **not** store secrets here.

### Core record set (must)
| Key | Required | Description |
| --- | --- | --- |
| `contenthash` | Optional | IPFS directory CID for a public receipt pack, or leave unset if using HTTP URLs only. |
| `text:schema` | ✅ | `"agijobmanager/v1"` |
| `text:agijobs.jobId` | ✅ | Job ID from the contract |
| `text:agijobs.contract` | ✅ | JobManager address |
| `text:agijobs.employer` | ✅ | Employer address |
| `text:agijobs.agent` | Optional | Assigned agent address (empty until assigned) |
| `text:agijobs.state` | ✅ | `CREATED|ASSIGNED|COMPLETION_REQUESTED|COMPLETED|REFUNDED|EXPIRED|CANCELLED|DISPUTED` |
| `text:agijobs.spec.public` | ✅ | URI to public job spec JSON (matches on‑chain `jobSpecURI`) |
| `text:agijobs.completion.public` | ✅ | URI to completion JSON (matches on‑chain `jobCompletionURI` and NFT intent) |
| `text:agijobs.ui` | Optional | Canonical job page link |

### Validator‑friendly record set (recommended)
| Key | Required | Description |
| --- | --- | --- |
| `text:agijobs.checklist` | Recommended | Validator checklist URL/URI |
| `text:agijobs.manifest` | Recommended | Artifact manifest URI |
| `text:agijobs.receipt` | Recommended | Receipt bundle URI (EIP‑712 or equivalent) |
| `text:agijobs.integrity` | Recommended | JSON string or URI with hashes/CIDs |
| `text:agijobs.privacy` | Recommended | `"public-receipt/private-artifacts"` or explicit mode |

## Copy/paste examples

### Example: minimal core records
```
contenthash = ipfs://bafy.../ (optional)
text:schema = agijobmanager/v1
text:agijobs.jobId = 42
text:agijobs.contract = 0x1234...ABCD
text:agijobs.employer = 0xEmploy...
text:agijobs.agent = 0xAgent...
text:agijobs.state = COMPLETED
text:agijobs.spec.public = ipfs://bafy.../spec.json
text:agijobs.completion.public = ipfs://bafy.../completion.json
text:agijobs.ui = https://example.com/jobs/1/42
```

### Example: validator‑friendly records
```
text:agijobs.checklist = ipfs://bafy.../validator_checklist.json
text:agijobs.manifest = ipfs://bafy.../artifact_manifest.json
text:agijobs.receipt = ipfs://bafy.../receipt_bundle.json
text:agijobs.integrity = {"specSha256":"...","completionSha256":"..."}
text:agijobs.privacy = public-receipt/private-artifacts
```

## Integration notes
- **Indexers** should treat ENS as an authoritative pointer, not the source of truth.
- **UIs** should fetch the job spec + completion JSON and render a human‑readable page.
- **Validators** should verify integrity hashes from `agijobs.integrity` when present.
