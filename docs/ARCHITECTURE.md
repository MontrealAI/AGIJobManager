# Architecture

## System overview

`AGIJobManager` is an owner-operated escrow and settlement contract for employer-agent jobs with validator voting, moderator dispute resolution, optional ENS job-page hooks, and ERC-721 completion NFT minting.

### Components and responsibilities

| Component | Type | Responsibility |
|---|---|---|
| `AGIJobManager` | Core contract | Job escrow, assignment, completion requests, validator voting, settlement, disputes, NFT issuance, reputation, owner controls. |
| `ENSJobPages` | Optional helper contract | Creates/upgrades per-job ENS records and handles best-effort lifecycle hooks. |
| `BondMath` | Library | Computes validator/agent bond amounts from current parameters. |
| `ReputationMath` | Library | Computes reputation increments for agent/validator outcomes. |
| `TransferUtils` | Library | ERC20 transfer wrappers, including exact-transfer behavior. |
| `UriUtils` | Library | URI validation + optional `baseIpfsUrl` prefixing. |
| `ENSOwnership` | Library | ENS/NameWrapper ownership verification for role gating. |
| ENS contracts (`ENSRegistry`, `NameWrapper`, `PublicResolver`) | External dependencies | Name ownership and resolver records for ownership gating and ENS job pages. |

## Component interaction diagram

```mermaid
flowchart LR
    Employer -->|createJob + escrow| AGIJobManager
    Agent -->|applyForJob + bond| AGIJobManager
    Validator -->|validate/disapprove + bond| AGIJobManager
    Moderator -->|resolveDispute*| AGIJobManager
    Owner -->|config/pause/roles| AGIJobManager

    AGIJobManager -->|ERC20 transfers| AGIToken[(AGI ERC20)]
    AGIJobManager -->|mint completion NFT| JobNFT[(ERC721 token in AGIJobManager)]
    AGIJobManager -->|best-effort handleHook| ENSJobPages

    ENSJobPages --> ENSRegistry[(ENS Registry)]
    ENSJobPages --> NameWrapper[(NameWrapper)]
    ENSJobPages --> PublicResolver[(PublicResolver)]

    AGIJobManager --> ENSOwnershipLib[ENSOwnership verify]
    ENSOwnershipLib --> ENSRegistry
    ENSOwnershipLib --> NameWrapper
```

## Job lifecycle (happy path)

```mermaid
sequenceDiagram
    participant E as Employer
    participant A as Agent
    participant V as Validators
    participant J as AGIJobManager
    participant P as ENSJobPages

    E->>J: createJob(specURI, payout, duration, details)
    J->>P: hook 1 (create page) [best-effort]
    A->>J: applyForJob(jobId, subdomain, proof)
    J->>P: hook 2 (assign) [best-effort]
    A->>J: requestJobCompletion(jobId, completionURI)
    J->>P: hook 3 (completion text) [best-effort]
    V->>J: validateJob/disapproveJob
    J->>J: challenge window / quorum logic
    J->>J: finalizeJob()
    alt agent-win
        J->>J: settle agent + validators
        J->>J: mint completion NFT to employer
    else employer-win
        J->>J: refund employer + settle validators
    end
    J->>P: hook 4 (revoke permissions) [best-effort]
    Note over E,J: lockJobENS(jobId,true) optional terminal operation (owner-only fuse burn)
```

## Job state machine

```mermaid
stateDiagram-v2
    [*] --> Created: createJob
    Created --> Assigned: applyForJob
    Created --> Cancelled: cancelJob/delistJob

    Assigned --> CompletionRequested: requestJobCompletion
    Assigned --> Expired: expireJob (after duration, no completion request)

    CompletionRequested --> Completed: finalizeJob or resolveDispute(agent-win)
    CompletionRequested --> Disputed: disapprove threshold / disputeJob / quorum tie-underflow
    CompletionRequested --> Refunded: finalizeJob employer-win

    Disputed --> Completed: resolveDispute(agent-win) / resolveStaleDispute(false)
    Disputed --> Refunded: resolveDispute(employer-win) / resolveStaleDispute(true)

    Completed --> [*]
    Refunded --> [*]
    Expired --> [*]
    Cancelled --> [*]
```

## Trust boundaries

### External calls
- ERC20 transfers (`safeTransfer`, `safeTransferFromExact`) are external token interactions and can fail/revert.
- ENS interactions are external calls to `ensJobPages` (which itself calls ENS registry/wrapper/resolver).
- Token URI fallback may `staticcall` ENS helper when `useEnsJobTokenURI` is enabled.

### Best-effort ENS behavior
- ENS hooks are intentionally non-blocking (`_callEnsJobPagesHook` emits `EnsHookAttempted` with success/failure).
- Settlement and escrow flows continue even if ENS hook calls fail.
- Implication: ENS metadata consistency is operational, not consensus-critical; operators must monitor hook failures.
