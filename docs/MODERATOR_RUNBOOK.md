# Moderator Runbook

Moderators resolve active disputes consistently using `resolveDisputeWithCode(jobId, code, reason)`.

## 1) Dispute triage decision tree

```text
Is job currently disputed?
  ├─ No -> stop (do not write)
  └─ Yes
      Is evidence package complete?
        ├─ No -> request evidence; do not resolve yet
        └─ Yes
            Which side satisfies policy better?
              ├─ Agent -> code 1
              ├─ Employer -> code 2
              └─ Insufficient confidence -> code 0 (log-only) and escalate
```

## 2) Resolution matrix

| Situation | Code | Effect |
|---|---:|---|
| Agent performed work per policy and evidence | 1 | agent-win settlement path |
| Employer dispute is substantiated | 2 | employer refund path |
| Evidence incomplete / procedural hold | 0 | emits event only; dispute remains active |

## 3) SOP for `resolveDisputeWithCode`

Minimum evidence checklist:
- `getJobCore(jobId)` and `getJobValidation(jobId)` outputs captured,
- job spec URI and completion URI snapshots,
- relevant communication/evidence references,
- rationale mapped to policy/rules.

Reason string format (required for consistency):
```text
CASE:<id>|EVIDENCE:<refs>|RULE:<policy>|OUTCOME:<0|1|2>|NOTE:<short text>
```

Examples:
- `CASE:117|EVIDENCE:specHash,completionHash|RULE:DELIVERY-1|OUTCOME:1|NOTE:deliverable matched acceptance criteria`
- `CASE:118|EVIDENCE:deadlineLog|RULE:DEADLINE-2|OUTCOME:2|NOTE:completion not submitted in valid window`

Consistency controls:
- Always use the matrix above.
- Avoid free-form outcomes; only 0/1/2.
- Use comparable evidence standards across similar cases.

## 4) Etherscan-only workflow

1. Read `getJobCore(jobId)`.
2. Read `getJobValidation(jobId)`.
3. Confirm dispute is active (`disputed == true`).
4. Confirm settlement not paused (`settlementPaused == false`).
5. Write `resolveDisputeWithCode(jobId, code, reason)`.
6. Save tx hash with case record.

## 5) Escalation

Escalate to owner when:
- repeated low-quality disputes indicate policy gap,
- suspected abuse/blacklist need,
- settlement pause may be necessary.
