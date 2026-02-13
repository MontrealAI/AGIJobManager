# Job Lifecycle

```mermaid
stateDiagram-v2
[*] --> Open
Open --> Assigned
Assigned --> CompletionRequested
CompletionRequested --> Disputed
CompletionRequested --> Settled
Disputed --> Settled
Assigned --> Expired
```

| Action | Employer | Agent | Validator | Moderator | Owner |
| --- | --- | --- | --- | --- | --- |
| applyForJob |  | ✅ |  |  |  |
| requestJobCompletion |  | ✅ |  |  |  |
| finalizeJob | ✅ |  |  |  |  |
| validate/disapprove |  |  | ✅ |  |  |
| resolveDisputeWithCode |  |  |  | ✅ |  |
| lockJobENS |  |  |  |  | ✅ |
