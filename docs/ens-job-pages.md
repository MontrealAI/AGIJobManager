# ENS “Job Page” conventions (AGI.Eth namespace)

This document defines the **recommended ENS naming scheme** and **record layout** for job pages under the `AGI.Eth` umbrella. These conventions are **off‑chain** and **indexer‑friendly**; they do not change contract behavior.

## Naming convention (official namespace)

Use one ENS name per job:

```
job-<chainId>-<jobId>.jobs.alpha.agi.eth
```

Example:
```
job-1-42.jobs.alpha.agi.eth
```

### Ownership model (recommended)
- **Owner of `jobs.alpha.agi.eth`**: the AGI.Eth operator (or platform owner). This keeps the namespace official and prevents spoofed job pages.
- **Per‑job subdomain owner**: the platform (or a dedicated registrar contract), which can delegate **resolver permissions** to the employer and assigned agent.

### Delegation model (resolver authorization)
- The platform keeps subdomain ownership but **authorizes** edits via resolver permissions.
- Employer + assigned agent receive edit rights to update job spec/completion records.
- Validators can read all records; they do not need edit rights.

### Optional record locking after completion
- After settlement, the resolver can **freeze** records to preserve receipt integrity.
- Locking is resolver‑dependent (e.g., NameWrapper fuses or resolver access control). Treat this as optional and explicitly document the mechanism used.

## ENS record layout

> **Privacy rule**: ENS text records are public. Do **not** store secrets here.

### Core record set (must)
| Key | Required | Description |
| --- | --- | --- |
| `contenthash` | Optional | IPFS directory CID for a public receipt pack, or leave unset if using HTTP URLs only. |
| `text:agijobs.version` | ✅ | `"1"` |
| `text:agijobs.chainId` | ✅ | Chain ID (e.g., `1`) |
| `text:agijobs.jobId` | ✅ | Job ID from the contract |
| `text:agijobs.contract` | ✅ | JobManager address |
| `text:agijobs.spec` | ✅ | URL/URI to public job spec JSON |
| `text:agijobs.completion` | ✅ | URL/URI to completion JSON (mirrors the NFT `tokenURI` intent) |
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
text:agijobs.version = 1
text:agijobs.chainId = 1
text:agijobs.jobId = 42
text:agijobs.contract = 0x1234...ABCD
text:agijobs.spec = ipfs://bafy.../spec.json
text:agijobs.completion = ipfs://bafy.../completion.json
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
- **UI/Frontend** should render the job by fetching `agijobs.spec` + `agijobs.completion`.
- **Validators** should verify integrity hashes from `agijobs.integrity` when present.
