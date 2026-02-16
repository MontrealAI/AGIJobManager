# MODERATOR_RUNBOOK

## 1) Dispute triage decision tree

```text
Is dispute active?
  no  -> stop (no moderator action)
  yes -> gather evidence bundle
         |
         v
Do facts clearly support one side under policy?
  no  -> code 0 (NO_ACTION) with reason and escalation note
  yes -> choose code 1 (AGENT_WIN) or 2 (EMPLOYER_WIN)
```

## 2) Resolution matrix

| Condition | Suggested code |
|---|---|
| completion evidence valid + obligations met | `1` (AGENT_WIN) |
| completion invalid/absent + employer claim supported | `2` (EMPLOYER_WIN) |
| insufficient/conflicting evidence | `0` (NO_ACTION) |

## 3) SOP: `resolveDisputeWithCode(jobId, code, reason)`

### Minimum evidence checklist
- `getJobCore(jobId)` snapshot
- `getJobValidation(jobId)` snapshot
- `getJobSpecURI(jobId)` and (if present) `getJobCompletionURI(jobId)`
- dispute claim summary from both parties
- any off-chain artifacts referenced by URI/hash

### Reason format (standardize)

```text
EVIDENCE:v1|summary:<one line>|facts:<key facts>|links:<refs>|policy:<section>|moderator:<id>|ts:<unix>
```

Examples:
- `EVIDENCE:v1|summary:milestones met|facts:delivery+acceptance logs match|links:ipfs://...|policy:ops-2.1|moderator:mod-07|ts:1736465000`
- `EVIDENCE:v1|summary:missing deliverable|facts:completion URI invalid|links:ipfs://...|policy:ops-2.3|moderator:mod-03|ts:1736465200`

### Consistency rules
- Use the same evidence threshold for similar cases.
- If uncertain, prefer code `0` and request more evidence.
- Never resolve based on private side-channel claims without verifiable references.

## 4) Etherscan-only workflow

1. Read `getJobCore(jobId)`.
2. Read `getJobValidation(jobId)`.
3. Read `getJobSpecURI(jobId)` and `getJobCompletionURI(jobId)`.
4. Confirm dispute is active.
5. Write `resolveDisputeWithCode(jobId, code, reason)`.
6. Save tx hash in moderator case log.
