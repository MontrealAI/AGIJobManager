# UI Architecture

## Route map
```mermaid
flowchart TD
  A[/] --> B[/jobs]
  B --> C[/jobs/{jobId}]
  A --> D[/admin]
  A --> E[/design]
  A --> F[/demo]
```

## High-level architecture
```mermaid
flowchart LR
  U[User Browser] --> N[Next.js App Router]
  N --> Q[React Query cache]
  N --> W[wagmi + viem + RainbowKit]
  W --> R[(RPC endpoint)]
  N --> D[(Demo fixtures JSON)]
  Q --> M[multicall reads]
```

## Transaction pipeline
```mermaid
sequenceDiagram
  participant User
  participant UI
  participant RPC
  User->>UI: Click action
  UI->>UI: Preflight checks (network/role/state)
  UI->>RPC: simulateContract()
  RPC-->>UI: simulation ok / custom error
  UI->>User: Await signature
  UI->>RPC: writeContract()
  RPC-->>UI: tx hash
  UI->>RPC: waitForTransactionReceipt()
  UI-->>User: confirmed/failed + decoded error + explorer links
```
