# Job metadata schema (ERC-721 compliant)

AGIJobManager uses **ERC-721 metadata JSON** for both job creation and job completion. The UI generates two separate
metadata artifacts:

- **Job Spec** (`jobSpec.v1.json`) — created at job creation time.
- **Job Completion** (`jobCompletion.v1.json`) — created when an agent requests completion. The NFT `tokenURI`
  must point to this completion metadata.

Both artifacts follow the same **versioned schema**:

```
"schema_version": "agijobmanager.job.v1"
```

## Required ERC-721 fields

Every metadata JSON **must** include the ERC-721 fields below:

- `name`
- `description`
- `image` **or** `animation_url`
- `external_url`
- `attributes`: array of `{ trait_type, value }` pairs

## Shared fields

| Field | Required | Notes |
| --- | --- | --- |
| `schema_version` | ✅ | Version string `agijobmanager.job.v1` |
| `name` | ✅ | Human-readable title (e.g., `Job #42: ...`) |
| `description` | ✅ | Markdown-supported text | 
| `image` / `animation_url` | ✅ | At least one must be present |
| `external_url` | ✅ | Canonical job page in the dapp (includes chainId + contract + jobId) |
| `attributes` | ✅ | Array of job traits (display metadata) |
| `properties` | ✅ | Structured data for detail pages |

## Job Spec metadata (`jobSpec.v1.json`)

A **Job Spec** describes the job requirements and payout terms that the employer publishes. It should include:

- Job title + summary + full description
- Links to repos/specs/datasets/contact methods
- Payout + duration info
- On-chain identifiers (chainId, contractAddress, jobId if known)

### Suggested `attributes` (spec)

- `Type`: `Job Spec`
- `Chain ID`
- `Contract`
- `Job ID`
- `Payout`
- `Duration (seconds)`

### Suggested `properties` (spec)

```
properties: {
  type: "job_spec",
  job: {
    job_id,
    chain_id,
    contract_address,
    payout_raw,
    payout,
    duration_seconds,
    summary,
    description,
  },
  payouts: {
    escrow_amount,
    agent_payout_pct,
    validator_reward_pct,
    additional_agent_payout_pct
  },
  links: [ { label, url } ],
  attachments: [ url, ... ]
}
```

## Job Completion metadata (`jobCompletion.v1.json`)

A **Job Completion** document records deliverables and links back to the spec. It should include:

- Reference to the job spec URI (and optional hash)
- Deliverables/submission links
- On-chain identifiers (jobId, chainId, contractAddress, tokenId if known)
- Payout summary and any tx hashes (optional)

### Suggested `attributes` (completion)

- `Type`: `Job Completion`
- `Chain ID`
- `Contract`
- `Job ID`
- `Status`: `Completed`

### Suggested `properties` (completion)

```
properties: {
  type: "job_completion",
  job: {
    job_id,
    chain_id,
    contract_address,
    token_id,
    job_spec_uri,
    job_spec_sha256,
    tx_hash
  },
  payouts: {
    escrow_amount,
    agent_payout_pct,
    validator_reward_pct,
    additional_agent_payout_pct
  },
  deliverables: [ url, ... ],
  links: [ { label, url } ],
  attachments: [ url, ... ]
}
```

## Canonical external URL

`external_url` should point to the job detail page in the dapp with identifiers included:

```
https://<dapp-host>/ui/agijobmanager.html?contract=<address>&chainId=<id>&jobId=<id>
```

## Examples

- `docs/examples/jobSpec.v1.json`
- `docs/examples/jobCompletion.v1.json`

## Notes

- **Job Completion** metadata must be minted as the NFT `tokenURI` for new jobs.
- `tokenURI` may be a full URL (`https://...` or `ipfs://...`) or a CID resolved via `baseIpfsUrl`.
- Keep secrets out of the repo; the UI only stores provider credentials in `localStorage`.
