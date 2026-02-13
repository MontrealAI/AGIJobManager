# Job Lifecycle

```mermaid
stateDiagram-v2
  [*] --> Open
  Open --> Assigned: apply
  Assigned --> CompletionRequested: request completion
  CompletionRequested --> Disputed: dispute
  CompletionRequested --> Settled: finalize/validate
  Disputed --> Settled: moderator resolve
  Assigned --> Expired: timeout
```

| Action | Employer | Agent | Validator | Moderator | Owner |
|---|---|---|---|---|---|
| cancelJob | ✅ | ❌ | ❌ | ❌ | ❌ |
| requestJobCompletion | ❌ | ✅ | ❌ | ❌ | ❌ |
| validateJob | ❌ | ❌ | ✅ | ❌ | ❌ |
| resolveDisputeWithCode | ❌ | ❌ | ❌ | ✅ | ❌ |
| lockJobENS | ❌ | ❌ | ❌ | ❌ | ✅ |
