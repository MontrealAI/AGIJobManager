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

Low-touch policy:
- If evidence is complete and objectively favors one side, resolve in a single transaction.
- If evidence is insufficient, always use `0` with a reason string that explicitly names missing artifacts.

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
5. Use offline helper for reason-template drafting if needed.
6. Write `resolveDisputeWithCode(jobId, code, reason)`.
7. Save tx hash and archive evidence bundle.

## 5) Autonomy tools and pre-resolution checklist

Use offline helper tooling to reduce judgment errors:

```bash
node scripts/advisor/state_advisor.js --input scripts/advisor/sample_job_state.json
```

Paste Etherscan read outputs and current block timestamp into the advisor input, then confirm:
- state is `DISPUTED`
- stale-dispute threshold (if relevant) is correctly computed
- no obvious role/timing contradiction is present

Pre-resolution checklist (must all be true):
1. dispute exists (`disputed == true`)
2. selected code matches matrix + evidence bundle
3. reason string includes ticket/policy references
4. linked artifacts are immutable (IPFS hash or content hash)
5. signer is authorized moderator/owner

## 6) Quick consistency checklist before submitting resolution tx

- Is code choice consistent with matrix and prior similar cases?
- Is reason string complete and parseable?
- Are all referenced artifacts immutable and retrievable?
- Is moderator signer authorized?
