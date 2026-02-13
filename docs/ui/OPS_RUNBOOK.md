# Ops Runbook

## Incident response
```mermaid
flowchart TD
  A[Alert: abnormal settlements] --> B{User-impacting?}
  B -- yes --> C[Pause protocol]
  B -- no --> D[Observe + collect logs]
  C --> E[Set settlementPaused if needed]
  E --> F[Coordinate moderator triage]
  F --> G[Publish post-incident notes]
```

## Safe parameter changes
```mermaid
flowchart LR
  P[Propose parameter] --> S[Simulate in UI]
  S --> R[Peer review]
  R --> T[Apply change]
  T --> V[Verify on-chain readback]
```

## Checklist table
| Procedure | Preconditions | Confirmation phrase |
|---|---|---|
| Pause/Unpause | Owner role verified | `PAUSE` |
| Settlement pause toggle | Owner role verified | `SETTLEMENT` |
| Lock identity config | Final ENS/merkle values frozen | `LOCK` |
| Withdraw AGI | paused=true and settlementPaused=false | `WITHDRAW` |
