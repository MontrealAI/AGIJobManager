# Ops Runbook

## Incident response (paused + settlementPaused)
```mermaid
flowchart TD
  A[Alert detected] --> B{Critical funds risk?}
  B -- Yes --> C[Owner pause()]
  C --> D[Assess blast radius + read-only comms]
  D --> E{Settlement safety impacted?}
  E -- Yes --> F[setSettlementPaused(true)]
  E -- No --> G[Keep settlement live]
  F --> H[Moderator triage disputes]
  G --> H
  H --> I[Patch config + validate in demo mode]
  I --> J[Unpause in staged sequence]
```

## Safe parameter change sequence
```mermaid
flowchart LR
  P0[Proposed config delta] --> P1[Impact review table]
  P1 --> P2[Dry run in NEXT_PUBLIC_DEMO_MODE=1]
  P2 --> P3[Owner typed confirmation]
  P3 --> P4[simulateContract() preflight]
  P4 --> P5[On-chain write]
  P5 --> P6[Post-change verification]
```

## Moderator dispute resolution playbook
1. Confirm dispute status and deadlines on `/jobs/[jobId]`.
2. Review completion URI and evidence URI via safe-link controls.
3. Choose resolution code (`0=NO_ACTION`, `1=AGENT_WIN`, `2=EMPLOYER_WIN`) with reason.
4. Confirm transaction pipeline outcome and explorer link.

## Identity lock guidance
- Lock identity wiring only after ENS registry, NameWrapper, roots, and `ensJobPages` are validated.
- Use typed phrase confirmation (`LOCK`) and simulation preflight before broadcast.

## Treasury withdrawal checklist
- Contract must be `paused == true` and `settlementPaused == false`.
- Verify `withdrawableAGI` positive and escrow solvency invariant.
- Execute with owner wallet; archive tx hash in ops log.
