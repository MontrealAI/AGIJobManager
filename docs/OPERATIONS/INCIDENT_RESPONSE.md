# Incident Response

```mermaid
%%{init: {"theme":"base","themeVariables":{"fontFamily":"ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial","background":"#14001F","primaryColor":"#4B1D86","primaryTextColor":"#E9DAFF","lineColor":"#7A3FF2","tertiaryColor":"#1B0B2A","noteBkgColor":"#1B0B2A","noteTextColor":"#E9DAFF"}}}%%
flowchart TD
  A[Incident detected] --> B{Active exploit or funds at immediate risk?}
  B -- Yes --> C[Owner calls pause]
  B -- No --> D{Need to stop new deposits/settlement mutations but keep controlled resolution?}
  D -- Yes --> E[setSettlementPaused(true)]
  D -- No --> F{Specific bad actor?}
  F -- Yes --> G[Blacklist agent/validator]
  F -- No --> H{Identity wiring risk?}
  H -- Yes --> I[lockIdentityConfiguration]
  H -- No --> J[Monitor + communicate]
  C --> K[Forensics + staged recovery + unpause criteria]
  E --> K
  G --> K
  I --> K
  J --> K
```

## Communications protocol

1. Declare incident severity and current control state.
2. Publish impacted functions and temporary operator guidance.
3. Share mitigation tx hashes and ETA for next update.

## Recovery gates

- Root cause identified and patched operationally.
- Accounting sanity check passed (locked totals, withdrawable calculation).
- Moderator queue drained or explicitly prioritized.


Operator field name reminder: `settlementPaused` is the explicit control flag toggled via `setSettlementPaused(bool)`.
