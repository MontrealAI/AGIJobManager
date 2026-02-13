# Job Lifecycle

```mermaid
stateDiagram-v2
  [*] --> Open
  Open --> Assigned
  Assigned --> CompletionRequested
  CompletionRequested --> Settled
  CompletionRequested --> Disputed
  Disputed --> Settled
  Assigned --> Expired
```

| Action | Employer | Agent | Validator | Moderator | Owner |
|---|---|---|---|---|---|
| cancelJob | Open/Assigned | - | - | - | - |
| finalizeJob | CompletionRequested | - | - | - | - |
| applyForJob | - | Open | - | - | - |
| requestJobCompletion | - | Assigned | - | - | - |
| validate/disapprove | - | - | CompletionRequested | - | - |
| resolveDisputeWithCode | - | - | - | Disputed | - |
| lockJobENS | - | - | - | - | Settled |
