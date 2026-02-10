# Test Architecture

## Harness overview

```mermaid
flowchart LR
    A[Mocha + Truffle] --> B[AGIJobManager integration suites]
    A --> C[ENSJobPages helper suites]
    A --> D[Utility harness suites]

    B --> E[AGIJobManager]
    B --> F[MockERC20 / Fail tokens]
    B --> G[MockENSJobPages]

    C --> H[ENSJobPages]
    C --> I[MockENSRegistry]
    C --> J[MockNameWrapper]
    C --> K[MockPublicResolver]

    D --> L[UtilsHarness]
    L --> M[BondMath]
    L --> N[ReputationMath]
    L --> O[ENSOwnership]
    L --> P[TransferUtils]
    L --> Q[UriUtils]
```

## Primary lifecycle sequence

```mermaid
sequenceDiagram
    participant Employer
    participant Agent
    participant Validator
    participant Moderator
    participant JM as AGIJobManager
    participant Token as AGI ERC20

    Employer->>Token: approve(payout)
    Employer->>JM: createJob(spec, payout, duration)
    Agent->>JM: applyForJob(jobId)
    Agent->>JM: requestJobCompletion(jobId, completionURI)
    Validator->>JM: validateJob/disapproveJob(jobId)
    alt approval path
      JM->>JM: finalizeJob(jobId)
      JM->>Token: payout agent + validators
    else dispute path
      Employer->>JM: disputeJob(jobId)
      Moderator->>JM: resolveDisputeWithCode(jobId, outcome)
      JM->>Token: settle outcome + bonds
    end
```

## Job state machine (tested)

```mermaid
stateDiagram-v2
    [*] --> Created
    Created --> Assigned: applyForJob
    Assigned --> CompletionRequested: requestJobCompletion
    Assigned --> Expired: expireJob (deadline)
    Created --> Cancelled: cancelJob (pre-assignment)
    CompletionRequested --> Finalized: finalizeJob
    CompletionRequested --> Disputed: disputeJob or disapproval threshold
    Disputed --> Finalized: resolveDisputeWithCode / resolveStaleDispute
    Expired --> [*]
    Cancelled --> [*]
    Finalized --> [*]
```

## ENS hook flow

```mermaid
sequenceDiagram
    participant JM as AGIJobManager
    participant EP as ENSJobPages
    participant ENS as ENS Registry
    participant NW as NameWrapper
    participant R as PublicResolver

    JM->>EP: handleHook(1..6, jobId)
    EP->>ENS: setSubnodeRecord (unwrapped root)
    EP->>NW: setSubnodeRecord / setChildFuses (wrapped root)
    EP->>R: setAuthorisation / setText
    Note over EP: Resolver + fuse operations are best-effort
```

## Roles and permissions matrix

| Role | Core tested capabilities | Representative suites |
|---|---|---|
| Owner | Pause/unpause, config updates, lock identity config, treasury withdrawal (paused) | `adminOps`, `economicSafety` |
| Moderator | Resolve disputes | `disputeHardening`, `securityRegression` |
| Employer | Create/cancel job, dispute, finalize in allowed windows | `happyPath`, `livenessTimeouts` |
| Agent | Apply, request completion, bond participation | `agentPayoutSnapshot`, `incentiveHardening` |
| Validator | Vote/disapprove with bond accounting and role gating | `validatorCap`, `escrowAccounting` |

## Failure-mode matrix

| Failure mode | Expected behavior | Covered by |
|---|---|---|
| ENS hook target reverts | Core lifecycle continues (best-effort hook) | `ensJobPagesHooks` |
| ENS resolver write fails | No lifecycle bricking; hook call remains non-critical | `ensJobPagesHelper` |
| NameWrapper fuse burn reverts | Emits lock event with `fusesBurned=false`; no revert | `ensJobPagesHelper` |
| ERC20 transfer returns false/reverts | Revert with `TransferFailed`; no partial accounting | `AGIJobManager.*`, `utils.transfer_uri` |
| Attempted double release/settlement | Blocked by terminal flags/accounting guards | `securityRegression`, `completionSettlementInvariant` |
