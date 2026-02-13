# UI Architecture

```mermaid
flowchart TD
  A[/] --> B[/jobs]
  B --> C[/jobs/:jobId]
  A --> D[/admin]
```

```mermaid
flowchart LR
  UI[Next.js UI] --> RQ[React Query]
  RQ --> RPC[(RPC)]
  UI --> W[Wallet]
  UI --> D[Demo fixtures]
```

```mermaid
sequenceDiagram
  actor U as User
  participant UI
  participant RPC
  U->>UI: Click write action
  UI->>UI: Preflight checks
  UI->>RPC: simulateContract
  UI->>U: Await signature
  UI->>RPC: broadcast tx
  UI->>RPC: wait receipt
  UI->>UI: decode custom error / success
```
