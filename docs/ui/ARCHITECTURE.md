# UI Architecture

```mermaid
flowchart TD
  A[/]/ --> B[/jobs/]
  B --> C[/jobs/[jobId]/]
  A --> D[/admin/]
  A --> E[/design/]
  A --> F[/demo/]
```

```mermaid
sequenceDiagram
  participant U as User
  participant UI as Next UI
  participant RPC as RPC
  U->>UI: Trigger write
  UI->>UI: Preflight checks
  UI->>RPC: simulateContract()
  RPC-->>UI: ok / custom error
  UI->>RPC: writeContract() when simulation passes
  RPC-->>UI: tx hash + receipt
```
