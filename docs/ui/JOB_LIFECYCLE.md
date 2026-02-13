# Job Lifecycle

```mermaid
stateDiagram-v2
  [*] --> Open
  Open --> Assigned: applyForJob
  Assigned --> CompletionRequested: requestJobCompletion
  CompletionRequested --> Settled: finalize/validate
  CompletionRequested --> Disputed: dispute
  Disputed --> Settled: moderator resolve
  Assigned --> Expired: timeout
  Settled --> Completed
  Settled --> Refunded
```

| Action | Employer | Agent | Validator | Moderator | Owner |
|---|---|---|---|---|---|
| cancelJob | Open/Assigned | - | - | - | - |
| finalizeJob | CompletionRequested | - | - | - | - |
| applyForJob | - | Open | - | - | - |
| requestJobCompletion | - | Assigned | - | - | - |
| validate/disapprove | - | - | CompletionRequested | - | - |
| resolveDisputeWithCode | - | - | - | Disputed | - |
| lockJobENS | - | - | - | - | Any |
