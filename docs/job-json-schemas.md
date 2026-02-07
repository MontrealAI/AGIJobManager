# Job JSON schemas (JobSpec + JobCompletion)

These schemas define **conventions** only. They do **not** require contract changes. They are aligned with the existing metadata guidance in [`docs/job-metadata.md`](job-metadata.md).

## Shared conventions
- **Schema version**: `"agijobmanager.job.v1"`.
- **ERC‑721 compatibility**: both documents include `name`, `description`, `external_url`, and `attributes`.
- **Completion JSON** is intended to be the **NFT `tokenURI`**.
- **Public vs private**: only publish **public receipt data** here; private artifacts should be referenced via gated links.

---

## JobSpec JSON schema (for `jobSpecURI`)

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://agijobs.ai/schemas/job-spec.v1.json",
  "title": "AGI Jobs JobSpec",
  "type": "object",
  "required": [
    "schema_version",
    "name",
    "description",
    "external_url",
    "attributes",
    "properties"
  ],
  "properties": {
    "schema_version": { "const": "agijobmanager.job.v1" },
    "name": { "type": "string" },
    "description": { "type": "string" },
    "image": { "type": "string" },
    "animation_url": { "type": "string" },
    "external_url": { "type": "string" },
    "attributes": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["trait_type", "value"],
        "properties": {
          "trait_type": { "type": "string" },
          "value": {}
        }
      }
    },
    "properties": {
      "type": "object",
      "required": ["type", "job"],
      "properties": {
        "type": { "const": "job_spec" },
        "job": {
          "type": "object",
          "required": ["job_id", "chain_id", "contract_address", "payout_raw", "duration_seconds"],
          "properties": {
            "job_id": { "type": ["integer", "string"] },
            "chain_id": { "type": ["integer", "string"] },
            "contract_address": { "type": "string" },
            "payout_raw": { "type": "string" },
            "payout": { "type": "string" },
            "duration_seconds": { "type": "integer" },
            "summary": { "type": "string" },
            "description": { "type": "string" }
          }
        },
        "payouts": {
          "type": "object",
          "properties": {
            "escrow_amount": { "type": "string" },
            "agent_payout_pct": { "type": "number" },
            "validator_reward_pct": { "type": "number" },
            "additional_agent_payout_pct": { "type": "number" }
          }
        },
        "links": {
          "type": "array",
          "items": {
            "type": "object",
            "required": ["label", "url"],
            "properties": {
              "label": { "type": "string" },
              "url": { "type": "string" }
            }
          }
        },
        "attachments": {
          "type": "array",
          "items": { "type": "string" }
        }
      }
    }
  },
  "oneOf": [
    { "required": ["image"] },
    { "required": ["animation_url"] }
  ]
}
```

**Example:** [`docs/examples/spec.json`](examples/spec.json)

**Quick excerpt:**
```json
{
  "schema_version": "agijobmanager.job.v1",
  "name": "Job #42: Dataset cleanup",
  "external_url": "https://example.com/jobs/1/42",
  "properties": {
    "type": "job_spec",
    "job": {
      "job_id": 42,
      "chain_id": 1,
      "contract_address": "0x1234...ABCD",
      "payout_raw": "1000000000000000000",
      "duration_seconds": 604800,
      "summary": "Normalize a dataset and provide a report"
    }
  }
}
```

---

## JobCompletion JSON schema (for `jobCompletionURI` + ERC‑721 metadata)

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://agijobs.ai/schemas/job-completion.v1.json",
  "title": "AGI Jobs JobCompletion",
  "type": "object",
  "required": [
    "schema_version",
    "name",
    "description",
    "external_url",
    "attributes",
    "properties"
  ],
  "properties": {
    "schema_version": { "const": "agijobmanager.job.v1" },
    "name": { "type": "string" },
    "description": { "type": "string" },
    "image": { "type": "string" },
    "animation_url": { "type": "string" },
    "external_url": { "type": "string" },
    "attributes": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["trait_type", "value"],
        "properties": {
          "trait_type": { "type": "string" },
          "value": {}
        }
      }
    },
    "properties": {
      "type": "object",
      "required": ["type", "job"],
      "properties": {
        "type": { "const": "job_completion" },
        "job": {
          "type": "object",
          "required": ["job_id", "chain_id", "contract_address", "job_spec_uri"],
          "properties": {
            "job_id": { "type": ["integer", "string"] },
            "chain_id": { "type": ["integer", "string"] },
            "contract_address": { "type": "string" },
            "token_id": { "type": ["integer", "string"] },
            "job_spec_uri": { "type": "string" },
            "job_spec_sha256": { "type": "string" },
            "tx_hash": { "type": "string" }
          }
        },
        "payouts": {
          "type": "object",
          "properties": {
            "escrow_amount": { "type": "string" },
            "agent_payout_pct": { "type": "number" },
            "validator_reward_pct": { "type": "number" },
            "additional_agent_payout_pct": { "type": "number" }
          }
        },
        "deliverables": {
          "type": "array",
          "items": { "type": "string" }
        },
        "links": {
          "type": "array",
          "items": {
            "type": "object",
            "required": ["label", "url"],
            "properties": {
              "label": { "type": "string" },
              "url": { "type": "string" }
            }
          }
        },
        "attachments": {
          "type": "array",
          "items": { "type": "string" }
        }
      }
    }
  },
  "oneOf": [
    { "required": ["image"] },
    { "required": ["animation_url"] }
  ]
}
```

**Example:** [`docs/examples/completion.json`](examples/completion.json)

**Quick excerpt:**
```json
{
  "schema_version": "agijobmanager.job.v1",
  "name": "Job #42 completion",
  "external_url": "https://example.com/jobs/1/42",
  "properties": {
    "type": "job_completion",
    "job": {
      "job_id": 42,
      "chain_id": 1,
      "contract_address": "0x1234...ABCD",
      "job_spec_uri": "ipfs://bafy.../spec.json"
    },
    "deliverables": ["ipfs://bafy.../report.pdf"],
    "links": [{"label": "Public summary", "url": "https://example.com/jobs/1/42/summary"}]
  }
}
```

---

## Optional: artifact manifest format

If you publish multiple artifacts, include a manifest for integrity checks:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://agijobs.ai/schemas/artifact-manifest.v1.json",
  "title": "AGI Jobs Artifact Manifest",
  "type": "object",
  "required": ["schema_version", "artifacts"],
  "properties": {
    "schema_version": { "const": "agijobmanager.artifact_manifest.v1" },
    "artifacts": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["path", "sha256"],
        "properties": {
          "path": { "type": "string" },
          "sha256": { "type": "string" },
          "cid": { "type": "string" }
        }
      }
    }
  }
}
```

**Example:** [`docs/examples/artifact_manifest.json`](examples/artifact_manifest.json)

---

## Optional: preview idea

A lightweight `preview/index.html` can render the spec + completion JSON for validators. It should:
- Fetch the `jobSpecURI` + `jobCompletionURI`.
- Render checksums from `artifact_manifest.json`.
- Avoid embedding any private links (keep those gated elsewhere).
