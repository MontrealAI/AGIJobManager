# UI Architecture

```mermaid
flowchart TD
  A[/] --> B[/jobs]
  B --> C[/jobs/:jobId]
  A --> D[/admin]
```

```mermaid
flowchart LR
  UI[Next.js App Router] --> Q[React Query]
  Q --> RPC[Viem public client]
  UI --> W[Wagmi + RainbowKit]
  RPC --> Chain[(Ethereum)]
```

```mermaid
sequenceDiagram
  participant U as User
  participant UI
  participant RPC
  U->>UI: Submit action
  UI->>UI: Preflight checks
  UI->>RPC: simulateContract()
  RPC-->>UI: ok/custom error
  UI->>U: Await signature
  UI->>RPC: writeContract()
  RPC-->>UI: tx hash + receipt
  UI->>U: Confirmed/Failed + decoded error
```
