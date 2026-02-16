# AGIJobManager Moderator Runbook

Use this for consistent, low-touch dispute handling from Etherscan only.

## 1) Dispute triage decision tree

```text
Is job actively disputed?
  no  -> stop (do not write)
  yes -> Is settlement paused?
           yes -> wait for owner to unpause settlement
           no  -> Is minimum evidence available?
                    no  -> request evidence, optionally log-only code 0
                    yes -> apply resolution matrix and resolve
```

## 2) Minimum evidence checklist

Collect at least:
- `getJobCore(jobId)` and `getJobValidation(jobId)` snapshots,
- `getJobSpecURI(jobId)` and `getJobCompletionURI(jobId)`,
- relevant off-chain evidence links/hashes,
- timeline notes (assignment, completion request, votes, dispute time),
- conflict statement from each side (if available).

## 3) Resolution matrix

| Situation | Code | Effect |
|---|---:|---|
| Need more evidence / no-op log | `0` | Leaves dispute active |
| Work accepted / agent should be paid | `1` | Completes job (agent-win path) |
| Work rejected / employer refunded | `2` | Refund/employer-win path |

Use code `0` when facts are incomplete to avoid inconsistent forced outcomes.

## 4) SOP: `resolveDisputeWithCode(jobId, code, reason)`

1. Read checks on Etherscan:
   - `getJobCore(jobId).disputed == true`
   - `getJobCore(jobId).completed == false`
   - `getJobCore(jobId).expired == false`
   - `settlementPaused == false`
2. Apply matrix above.
3. Use standardized reason format:

```text
case:<id>|evidence:<uri_or_hash>|finding:<one_line>|policy:<version>|moderator:<handle>
```

Examples:
- `case:2026-02-001|evidence:ipfs://bafy...|finding:deliverable meets spec|policy:v1.2|moderator:ops-a`
- `case:2026-02-002|evidence:0xabc123...|finding:material non-delivery|policy:v1.2|moderator:ops-b`

4. Submit write call on Etherscan:
   - `resolveDisputeWithCode(jobId, code, reason)`
5. Record tx hash in moderation log.

## 5) Etherscan-only quick workflow

1. Read:
   - `getJobCore(jobId)`
   - `getJobValidation(jobId)`
   - `getJobSpecURI(jobId)`
   - `getJobCompletionURI(jobId)`
2. Verify evidence references.
3. Write: `resolveDisputeWithCode`.
4. Re-read core/validation to confirm terminal transition if code `1` or `2`.

## 6) Consistency guardrails

- Never resolve without a standardized reason string.
- For similar fact patterns, reuse same policy rationale.
- Escalate ambiguous legal/content issues before deciding.
- Prefer code `0` over rushed final resolution.
