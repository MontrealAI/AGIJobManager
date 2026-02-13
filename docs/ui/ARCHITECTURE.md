# UI Architecture

```mermaid
flowchart TD
  A[/dashboard/] --> B[/jobs/]
  B --> C[/jobs/:jobId/]
  A --> D[/admin/]
  A --> E[/design/]
  subgraph Clients
    A
    B
    C
    D
    E
  end
  Clients --> Q[React Query cache]
  Clients --> W[wagmi + viem]
  W --> R[(RPC)]
  W --> X[(Wallet)]
```

```mermaid
flowchart LR
  UI[Route component] --> RQ[react-query useQuery]
  RQ --> MC[multicall batch reads]
  MC --> RPC[(public RPC or env RPC)]
  RPC -->|success| CACHE[cache + stale-while-revalidate]
  RPC -->|error/retry| DEG[degraded RPC banner]
  DEG --> RETRY[user retry button]
  RETRY --> RQ
```

```mermaid
sequenceDiagram
  participant U as User
  participant UI as App Router UI
  participant RQ as React Query
  participant RPC as JSON-RPC
  U->>UI: Trigger write action
  UI->>UI: Preflight (network/role/state/balance)
  UI->>RPC: simulateContract()
  RPC-->>UI: ok or custom error
  UI->>U: Awaiting signature
  UI->>RPC: writeContract()
  RPC-->>RQ: tx hash + receipt
  RQ-->>UI: refresh state
  UI->>U: Confirmed/Failed + explorer links
```

| Failure mode | Detection point | UI behavior |
|---|---|---|
| RPC unavailable | query error / timeout | Degraded RPC banner, retain last data, show Retry |
| Chain mismatch | wallet chain id check | network mismatch banner + write disabled |
| Simulation revert | `simulateContract` throws | decode custom error + remediation guidance |
| Transaction dropped | receipt timeout | stepper marks failed with explorer link + retry |
