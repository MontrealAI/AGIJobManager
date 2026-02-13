# Ops Runbook

## Incident response (pause control)
```mermaid
flowchart TD
  A[Incident detected] --> B{Funds at risk?}
  B -- yes --> C[Owner pause]
  C --> D[Set settlementPaused if needed]
  D --> E[Communicate status + ETA]
  B -- no --> F[Observe + gather telemetry]
```

## Safe parameter change
```mermaid
flowchart TD
  A[Draft parameter change] --> B[Test in demo fixtures]
  B --> C[Run ui test + docs:check]
  C --> D[Owner simulation]
  D --> E[Execute on-chain]
  E --> F[Post-change verification]
```

## Operational checklists
- **Pause / unpause**: typed confirmation, simulation success, broadcast, verify banners.
- **Dispute moderation**: record reason code (0/1/2), attach rationale, verify final state.
- **Identity lock**: dry-run once, formal sign-off, execute only after registry wiring is final.
- **Treasury withdrawal**: only while `paused && !settlementPaused`, verify `withdrawableAGI` and escrow solvency.
