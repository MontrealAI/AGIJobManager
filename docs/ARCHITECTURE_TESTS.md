# Test Architecture and Operational Reliability

## Test harness architecture

```mermaid
flowchart LR
  subgraph Test Runner
    T[Truffle + Mocha]
  end

  subgraph Core
    M[AGIJobManager]
    EJP[ENSJobPages]
  end

  subgraph Utility Libraries
    BM[BondMath]
    RM[ReputationMath]
    EO[ENSOwnership]
    UU[UriUtils]
    TU[TransferUtils]
  end

  subgraph Test Doubles
    ERC20[MockERC20 / FailingERC20 / FeeOnTransferToken]
    ENS[MockENSRegistry]
    WRAP[MockNameWrapper]
    RES[MockResolver/PublicResolver]
    HOOK[MockENSJobPages]
  end

  T --> M
  T --> EJP
  T --> BM
  T --> RM
  T --> EO
  T --> UU
  T --> TU

  M --> ERC20
  M --> ENS
  M --> WRAP
  M --> RES
  M --> HOOK
  EJP --> ENS
  EJP --> WRAP
  EJP --> RES
```

## Primary lifecycle sequence

```mermaid
sequenceDiagram
  participant Employer
  participant Agent
  participant Validators
  participant Moderator
  participant Manager as AGIJobManager
  participant ENS as ENSJobPages

  Employer->>Manager: createJob(payout, duration, metadataURI)
  Manager-->>ENS: hook 1 (best-effort)
  Agent->>Manager: applyForJob(jobId)
  Manager-->>ENS: hook 2 (best-effort)
  Agent->>Manager: requestJobCompletion(jobId, completionURI)
  Manager-->>ENS: hook 3 (best-effort)
  Validators->>Manager: validate/disapprove(jobId)
  alt No dispute
    Employer->>Manager: finalizeJob(jobId)
    Manager-->>ENS: hook 4/5 (best-effort)
  else Dispute
    Employer->>Manager: disputeJob(jobId)
    Moderator->>Manager: resolveDisputeWithCode(jobId, AGENT_WIN/EMPLOYER_WIN)
    Manager-->>ENS: hook 4/5/6 (best-effort)
  end
```

## Job state model used by tests

```mermaid
stateDiagram-v2
  [*] --> Open: createJob
  Open --> Assigned: applyForJob
  Assigned --> CompletionRequested: requestJobCompletion

  CompletionRequested --> Finalized: finalizeJob / approvals / no-vote timeout
  CompletionRequested --> Disputed: disputeJob or disapproval threshold
  Disputed --> Finalized: resolveDisputeWithCode / resolveStaleDispute

  Assigned --> Expired: expireJob
  Open --> Cancelled: cancelJob / delistJob
```

## ENS hook flow

```mermaid
flowchart TD
  A[AGIJobManager terminal/lifecycle action] --> B{ensJobPages configured?}
  B -- No --> F[Skip hook, continue core flow]
  B -- Yes --> C[ENSJobPages.handleHook]
  C --> D{ENS/Wrapper/Resolver call succeeds?}
  D -- Yes --> E[Emit hook-related event and continue]
  D -- No --> G[Best-effort failure path: no revert]
  E --> H[Core lifecycle remains successful]
  G --> H
  F --> H
```

## Roles and permissions matrix

| Role | High-impact actions |
| --- | --- |
| Owner | Pause/unpause, parameter updates, allow/deny lists, treasury withdraw (paused only), identity config lock |
| Moderator | Resolve disputes |
| Employer | Create/cancel jobs, dispute, finalize where applicable |
| Agent | Apply, request completion |
| Validator | Validate/disapprove with bond and eligibility checks |

## Failure-mode matrix

| Failure mode | Expected behavior (tested) |
| --- | --- |
| ENS hook target reverts | Core AGIJobManager action proceeds (best-effort hook). |
| Resolver write failure in ENSJobPages | Hook emits failure signal path, core flow remains live. |
| ERC20 returns `false` | Transfer wrappers revert `TransferFailed`. |
| ERC20 fee-on-transfer under-delivers | `safeTransferFromExact` reverts. |
| Stale dispute not yet timed out | `resolveStaleDispute` reverts until review period elapses. |
| Insolvent withdrawal attempt | `withdrawableAGI`/withdraw paths reject unsafe extraction. |
