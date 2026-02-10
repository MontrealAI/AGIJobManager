# Contracts Overview

## Purpose
High-level map of contracts, major workflows, and cross-contract calls.

## Audience
Developers and auditors.

## Preconditions / assumptions
- Core runtime contract is `contracts/AGIJobManager.sol`.
- ENS publication is optional via `contracts/ens/ENSJobPages.sol`.

## Contract inventory
| Contract | Type | Responsibility |
|---|---|---|
| `AGIJobManager` | Core | Escrow, job lifecycle, validator voting, disputes, payouts/refunds, reputation, ERC-721 completion NFT. |
| `ENSJobPages` | Integration | Creates/manages ENS job pages and handles hook callbacks. |
| Utility libraries | Linked libs | URI handling, ERC20 transfer safety, bond math, reputation math, ENS ownership checks. |
| ENS interfaces | Interfaces | Minimal interaction surface with ENS Registry/NameWrapper/PublicResolver. |

## Call graph (overview)
```mermaid
flowchart TD
  AJM[AGIJobManager]
  TF[TransferUtils]
  BM[BondMath]
  RM[ReputationMath]
  EO[ENSOwnership]
  UU[UriUtils]
  ENSP[IENSJobPages hook target]

  AJM --> TF
  AJM --> BM
  AJM --> RM
  AJM --> EO
  AJM --> UU
  AJM -.best effort.-> ENSP
```

## Workflow snapshots

### Job lifecycle
```mermaid
sequenceDiagram
  participant Employer
  participant Agent
  participant Validators
  participant Contract as AGIJobManager

  Employer->>Contract: createJob(specURI,payout,duration,details)
  Agent->>Contract: applyForJob(jobId,subdomain,proof)
  Agent->>Contract: requestJobCompletion(jobId,completionURI)
  Validators->>Contract: validateJob / disapproveJob
  alt approvals path
    AnyCaller->>Contract: finalizeJob(jobId)
    Contract-->>Agent: payout + (possibly) agent bond return
    Contract-->>Employer: completion NFT mint
  else dispute path
    Employer->>Contract: disputeJob(jobId)
    Moderator->>Contract: resolveDisputeWithCode(jobId,code,reason)
  end
```

### ENS hook lifecycle (optional)
```mermaid
flowchart TD
  A[Job event in AGIJobManager] --> B[_callEnsJobPagesHook(hook,jobId)]
  B --> C{External call success?}
  C -->|yes| D[EnsHookAttempted(...,true)]
  C -->|no| E[EnsHookAttempted(...,false)]
  E --> F[Continue core settlement path]
```

## Gotchas / failure modes
- ENS hooks are non-blocking by design.
- Validator loops are bounded with `MAX_VALIDATORS_PER_JOB`.
- AGI type list is bounded with `MAX_AGI_TYPES`.

## References
- [`../contracts/AGIJobManager.sol`](../contracts/AGIJobManager.sol)
- [`../contracts/ens/ENSJobPages.sol`](../contracts/ens/ENSJobPages.sol)
- [`./contracts/Utilities.md`](./contracts/Utilities.md)
