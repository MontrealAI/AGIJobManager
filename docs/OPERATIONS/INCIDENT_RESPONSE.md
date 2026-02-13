# Incident Response

```mermaid
flowchart TD
    A[Alert detected] --> B{Active exploit in progress?}
    B -- Yes --> C[Call pause()]
    B -- No --> D{Need to stop new settlements but allow resolution prep?}
    D -- Yes --> E[setSettlementPaused(true)]
    D -- No --> F{Single bad actor?}
    F -- Yes --> G[blacklistAgent / blacklistValidator]
    F -- No --> H{Identity wiring risk?}
    H -- Yes --> I[lockIdentityConfiguration()]
    H -- No --> J[Continue monitoring + comms]
```

## Playbook

- Contain: choose `pause` vs `settlementPaused` based on blast radius.
- Preserve evidence: capture tx hashes, block ranges, affected job IDs.
- Communicate: post operator status update with next checkpoint.
- Recover: unpause only after root cause and compensating controls are in place.

> **Safety warning**
> `lockIdentityConfiguration()` is permanent; execute only with change-control signoff.
