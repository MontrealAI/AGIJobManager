# MODERATOR_RUNBOOK

Consistency-first dispute operations for `resolveDisputeWithCode`.

## 1) Dispute triage decision tree

```text
Is job currently disputed?
  no  -> stop (no action)
  yes -> gather minimum evidence set
            |
            v
Is evidence sufficient and internally consistent?
  no  -> resolutionCode 0 (NO_ACTION), request more evidence
  yes -> which side is supported by evidence/policy?
            |                     |
            |                     +--> employer supported -> code 2 (EMPLOYER_WIN)
            +--> agent supported  -> code 1 (AGENT_WIN)
```

## 2) Resolution matrix

| Situation | Code | Expected effect |
|---|---:|---|
| Evidence incomplete/conflicting | 0 | Dispute stays active |
| Agent fulfilled scoped deliverables | 1 | Agent-win settlement path |
| Employer claim is substantiated (non-delivery/non-compliance) | 2 | Employer refund path |

## 3) SOP for `resolveDisputeWithCode(jobId, resolutionCode, reason)`

### Minimum evidence checklist (required)
- Snapshot of `getJobCore(jobId)`.
- Snapshot of `getJobValidation(jobId)`.
- `getJobSpecURI(jobId)` and `getJobCompletionURI(jobId)` (if set).
- Parties’ claims and timestamps.
- Artifact references (hashes/URIs) used in decision.

### Required reason-string format

```text
EVIDENCE:v1|summary:<one-line>|facts:<fact-list>|links:<uri-list>|policy:<section>|moderator:<id>|ts:<unix>
```

Examples:
- `EVIDENCE:v1|summary:scope complete|facts:spec-v1 hash matched + deliverables present|links:ipfs://...|policy:mod-2.1|moderator:mod-07|ts:1736465000`
- `EVIDENCE:v1|summary:missing milestone|facts:no evidence for milestone-2|links:ipfs://...|policy:mod-2.3|moderator:mod-03|ts:1736465200`

### Consistency rules
- Apply same threshold across similar cases.
- If uncertain, default to code `0` and request additional evidence.
- Never resolve from unverifiable private claims.
- Always archive tx hash + reason string with case ID.

## 4) Etherscan-only workflow

1. In `Read Contract`: call `getJobCore(jobId)`.
2. In `Read Contract`: call `getJobValidation(jobId)`.
3. In `Read Contract`: call `getJobSpecURI(jobId)` and `getJobCompletionURI(jobId)`.
4. Confirm `disputed` is active and timeline is coherent.
5. In `Write Contract`: call `resolveDisputeWithCode(jobId, resolutionCode, reason)`.
6. Save transaction hash in moderation log.
