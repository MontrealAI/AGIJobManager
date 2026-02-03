# JobStatus (canonical job lifecycle)

`jobStatus(jobId)` has been removed from current deployments to reduce runtime bytecode size. Use
`getJobCore(jobId)`, `getJobValidation(jobId)`, `getJobURIs(jobId)`, and events to derive lifecycle
state off-chain. The mapping below remains the canonical ordering for reference and UI compatibility.

## Precedence order

When multiple flags could apply, the contract resolves status in this order:

1) **Completed**
2) **Deleted**
3) **Disputed**
4) **Open**
5) **CompletionRequested**
6) **Expired**
7) **InProgress**

## Status table (numeric mapping)

| Value | Name | Condition |
| --- | --- | --- |
| 0 | Deleted | `employer == address(0)` (cancel/delete representation). |
| 1 | Open | Employer set, no assigned agent. |
| 2 | InProgress | Assigned agent, no completion request, not completed, not disputed, not expired. |
| 3 | CompletionRequested | `completionRequested == true` and not completed, not disputed. |
| 4 | Disputed | `disputed == true` and not completed. |
| 5 | Completed | `completed == true`. |
| 6 | Expired | Time-derived: assigned agent with `block.timestamp > assignedAt + duration`, not completed, not disputed, no completion request. |

## Notes

- **Deleted** is used for cancelled/deleted records and does not imply any on-chain settlement beyond the cancel path.
- **Expired** is computed and **informational** unless an explicit expiry/settlement function is called.
- UI clients derive status from the getters/events when `jobStatus` is unavailable.
