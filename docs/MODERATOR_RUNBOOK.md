# MODERATOR_RUNBOOK

Goal: produce consistent dispute outcomes with minimal manual judgment.

## 1) Dispute triage decision tree

```text
Is disputed == true?
  no  -> stop (no moderator action)
  yes -> gather evidence bundle
          |
          v
Do objective facts satisfy one side under policy?
  no  -> resolveDisputeWithCode(jobId, 0, reason) and request more evidence
  yes -> choose 1 (AGENT_WIN) or 2 (EMPLOYER_WIN)
```

## 2) Resolution matrix

| Situation | Code |
|---|---|
| Deliverable evidence supports agent obligations completed | `1` (`AGENT_WIN`) |
| Evidence supports employer claim of non-performance/non-compliance | `2` (`EMPLOYER_WIN`) |
| Evidence incomplete or contradictory | `0` (`NO_ACTION`) |

## 3) SOP: `resolveDisputeWithCode(jobId, code, reason)`

### Minimum evidence checklist (required)
- `getJobCore(jobId)` snapshot
- `getJobValidation(jobId)` snapshot
- `getJobSpecURI(jobId)` content reference
- `getJobCompletionURI(jobId)` content reference (if present)
- timestamped summary from both sides
- links/hashes for external evidence

### Standard reason-string format

```text
EVIDENCE:v1|summary:<one line>|facts:<key facts>|links:<ipfs/urls>|policy:<section>|moderator:<id>|ts:<unix>
```

Examples:
- `EVIDENCE:v1|summary:milestones met|facts:delivery hashes match acceptance terms|links:ipfs://...|policy:ops-2.1|moderator:mod-07|ts:1736465000`
- `EVIDENCE:v1|summary:missing deliverable|facts:completion URI non-conforming|links:ipfs://...|policy:ops-2.3|moderator:mod-03|ts:1736465200`

### Consistency rules
- Apply the same evidence threshold for similar disputes.
- Never use unverifiable private side channels as sole basis.
- If uncertain, prefer code `0` and ask for clarifying evidence.
- Keep a structured moderator case log (jobId, code, reason, tx hash).

## 4) Etherscan-only workflow

1. Read `getJobCore(jobId)`.
2. Read `getJobValidation(jobId)`.
3. Read `getJobSpecURI(jobId)` and `getJobCompletionURI(jobId)`.
4. Confirm dispute state is active (`disputed == true`).
5. Optionally run offline advisor on pasted values for timing sanity.
6. Write `resolveDisputeWithCode(jobId, code, reason)`.
7. Save tx hash and archive evidence bundle.

## 5) Moderator autonomy checklist (before signing)

- Is code choice consistent with resolution matrix and prior similar cases?
- Is reason string complete, parseable, and ticket-linked?
- Are all referenced artifacts immutable and retrievable?
- Is signer currently authorized moderator/owner?
- Is there any conflict of interest that requires reassignment?

Offline helper:
```bash
node scripts/advisor/state_advisor.js --input scripts/advisor/sample_job_state.json
```
