# Job Lifecycle

```mermaid
stateDiagram-v2
  [*] --> Open
  Open --> Assigned
  Assigned --> CompletionRequested
  CompletionRequested --> Disputed
  CompletionRequested --> Settled
  Assigned --> Expired
  Disputed --> Settled
```

| Action | Employer | Agent | Validator | Moderator | Owner |
| --- | --- | --- | --- | --- | --- |
| cancelJob | ✅ pre-assignment | ❌ | ❌ | ❌ | ❌ |
| requestJobCompletion | ❌ | ✅ assigned | ❌ | ❌ | ❌ |
| validate/disapprove | ❌ | ❌ | ✅ role-gated | ❌ | ❌ |
| resolveDisputeWithCode | ❌ | ❌ | ❌ | ✅ disputed | ❌ |
| lockJobENS | ❌ | ❌ | ❌ | ❌ | ✅ |
