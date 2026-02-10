# AGIJobManager Architecture

## System overview

### Components and responsibilities
- **AGIJobManager (`contracts/AGIJobManager.sol`)**: core escrow, job lifecycle, bond accounting, validator voting, dispute handling, NFT issuance, reputation updates, pause controls, and owner configuration.
- **ENSJobPages (`contracts/ens/ENSJobPages.sol`)**: optional ENS mirror for job pages and metadata; invoked via best-effort lifecycle hooks.
- **Utility libraries (`contracts/utils/*.sol`)**:
  - `BondMath`: computes validator and agent bond sizes.
  - `ReputationMath`: computes bounded reputation growth points.
  - `ENSOwnership`: helper checks for ENS/NameWrapper/resolver ownership.
  - `TransferUtils`: strict ERC20 transfer wrappers.
  - `UriUtils`: URI validation and base IPFS prefix application.
- **External systems**:
  - ERC20 AGI token (`agiToken`) for escrow and bonds.
  - ENS registry + NameWrapper + PublicResolver used for identity gating and ENS pages.

## Component interaction diagram

```mermaid
flowchart LR
    EMP[Employer] -->|createJob + escrow AGI| AJM[AGIJobManager]
    AGT[Agent] -->|applyForJob + agent bond| AJM
    VAL[Validator] -->|validate/disapprove + validator bond| AJM
    MOD[Moderator] -->|resolveDispute*| AJM
    OWN[Owner] -->|config/pause/lock identity| AJM

    AJM -->|safeTransfer/safeTransferFrom| ERC20[(AGI ERC20)]
    AJM -->|best-effort hook 1..6| ENSJP[ENSJobPages]
    ENSJP --> ENS[(ENS Registry)]
    ENSJP --> WRAP[(NameWrapper)]
    ENSJP --> RES[(PublicResolver)]
    AJM --> NFT[(ERC721 job NFT mint)]
```

## Happy-path job lifecycle (sequence)

```mermaid
sequenceDiagram
    participant Employer
    participant Agent
    participant Validators
    participant AGIJobManager
    participant ENSJobPages

    Employer->>AGIJobManager: createJob(specURI, payout, duration, details)
    AGIJobManager-->>ENSJobPages: hook 1 (create) best-effort

    Agent->>AGIJobManager: applyForJob(jobId, subdomain, proof)
    AGIJobManager-->>ENSJobPages: hook 2 (assign) best-effort

    Agent->>AGIJobManager: requestJobCompletion(jobId, completionURI)
    AGIJobManager-->>ENSJobPages: hook 3 (completion) best-effort

    Validators->>AGIJobManager: validateJob(...) votes
    AGIJobManager->>AGIJobManager: challenge period / review checks

    alt approvals lead and windows satisfied
      anyone->>AGIJobManager: finalizeJob(jobId)
      AGIJobManager->>AGIJobManager: settle agent + validators + reputation
      AGIJobManager->>AGIJobManager: mint completion NFT
      AGIJobManager-->>ENSJobPages: hook 4 (revoke) best-effort
    else dispute path
      Validator/Employer/Agent->>AGIJobManager: disapprove/disputeJob
      Moderator->>AGIJobManager: resolveDisputeWithCode(...)
      AGIJobManager->>AGIJobManager: settle win/loss path
      AGIJobManager->>AGIJobManager: mint NFT only on agent-win
      AGIJobManager-->>ENSJobPages: hook 4 (revoke) best-effort
    end
```

## Job state machine

```mermaid
stateDiagram-v2
    [*] --> Created: createJob
    Created --> Assigned: applyForJob
    Created --> Cancelled: cancelJob / delistJob

    Assigned --> CompletionRequested: requestJobCompletion
    Assigned --> Expired: expireJob

    CompletionRequested --> Completed: finalizeJob (agent-win)
    CompletionRequested --> Refunded: finalizeJob (employer-win)
    CompletionRequested --> Disputed: disputeJob or disapproval threshold

    Disputed --> Completed: resolveDispute* agent-win
    Disputed --> Refunded: resolveDispute* employer-win
    Disputed --> Completed: resolveStaleDispute(false)
    Disputed --> Refunded: resolveStaleDispute(true)

    Completed --> ENSRevoked: hook 4
    Refunded --> ENSRevoked: hook 4
    Expired --> ENSRevoked: hook 4
```

## Trust boundaries

### External calls
- **ERC20 transfers** are performed through `TransferUtils` wrappers and can revert settlement/withdraw flows if token transfers fail.
- **ENS hooks** are called with fixed gas (`ENS_HOOK_GAS_LIMIT`) and are deliberately best-effort (`call` return value emitted as `EnsHookAttempted`), so lifecycle operations continue if ENS integration fails.
- **ENS URI fetch for NFT minting** is optional and best-effort (`staticcall` + fallback to completion URI).

### Best-effort implications
- A job can settle correctly even if ENS hooks fail.
- ENS page state may lag or be incomplete; on-chain escrow/accounting remains canonical.
- Operators must monitor `EnsHookAttempted` and reconcile ENS issues operationally rather than expecting automatic rollback.
