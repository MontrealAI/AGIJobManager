# ERC-8004 ↔ AGIJobManager flow

```mermaid
flowchart LR
    subgraph Off-chain signaling
        A[Agents & Validators] --> B[ERC-8004 registration file]
        B --> C[Identity registry (agentURI)]
        D[AGIJobManager events] --> E[Adapter export_feedback.js]
        E --> F[reputation-v1 files]
        F --> G[Indexers / Rankers]
        G --> H[Policy / allowlists]
    end

    H -->|Merkle roots & allowlists| I[AGIJobManager contract]
    I --> J[Escrow, payouts,
    disputes, reputation]
```
