# AGIJobManager Contract Guide

## Permissions matrix

| Action | Owner | Moderator | Employer | Agent | Validator | Anyone |
| --- | --- | --- | --- | --- | --- | --- |
| Create/cancel own job |  |  | ✅ |  |  |  |
| Apply/request completion |  |  |  | ✅ |  |  |
| Validate/disapprove |  |  |  |  | ✅ (eligible) |  |
| Resolve dispute |  | ✅ |  |  |  |  |
| Emergency controls / param updates | ✅ |  |  |  |  |  |
| Expire eligible jobs |  |  |  |  |  | ✅ |

## Lifecycle

```mermaid
stateDiagram-v2
    [*] --> Created
    Created --> Assigned: applyForJob
    Assigned --> CompletionRequested: requestJobCompletion
    CompletionRequested --> Approved: validator threshold met
    CompletionRequested --> Disapproved: disapproval threshold met
    CompletionRequested --> Disputed: disputeJob
    Approved --> Completed: finalizeJob after challenge window
    Disapproved --> Refunded: finalizeJob
    Disputed --> Completed: resolveDispute (agent wins)
    Disputed --> Refunded: resolveDispute (employer wins)
    Created --> Cancelled: cancelJob
    Assigned --> Expired: expireJob
```

## Dispute + finalize sequence

```mermaid
sequenceDiagram
    participant E as Employer
    participant A as Agent
    participant V as Validators
    participant M as Moderator
    participant C as AGIJobManager
    A->>C: requestJobCompletion(jobId, completionURI)
    V->>C: validateJob/disapproveJob
    alt disputed
      E->>C: disputeJob(jobId)
      M->>C: resolveDisputeWithCode(jobId, code, reason)
    else no dispute
      E->>C: finalizeJob(jobId)
    end
    C-->>E: refund or settlement
    C-->>A: payout + bond outcome
```

## Bonds, accounting, and timing

- Escrow: employer payout locked at job creation.
- Agent bond: posted on apply; returned/slashed at settlement.
- Validator bond: posted per vote and settled by final outcome.
- Dispute bond: posted by disputant and settled by resolution.
- Timing windows: job duration, completion review period, dispute review period, post-approval challenge window.

> **Safety warning**
> Operators should monitor `withdrawableAGI()` and lock variables before treasury operations.
