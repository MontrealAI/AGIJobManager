# Job Lifecycle

```mermaid
stateDiagram-v2
  [*] --> Open
  Open --> Assigned: applyForJob
  Assigned --> CompletionRequested: requestJobCompletion
  CompletionRequested --> Completed: finalize/validate
  CompletionRequested --> Disputed: dispute
  Disputed --> Completed: moderator resolves agent win
  Disputed --> Refunded: moderator resolves employer win
  Assigned --> Expired
```

| Action | Employer | Agent | Validator | Moderator | Owner |
| --- | --- | --- | --- | --- | --- |
| cancelJob | Open/Assigned | - | - | - | - |
| applyForJob | - | Open | - | - | - |
| requestJobCompletion | - | Assigned | - | - | - |
| validateJob/disapproveJob | - | - | CompletionRequested | - | - |
| resolveDisputeWithCode | - | - | - | Disputed | - |
| lockJobENS | - | - | - | - | Disputed |
