# Job lifecycle derivation

`AGIJobManager` now exposes granular getters (`getJobCore`, `getJobValidation`) and expects
indexers/UIs to derive lifecycle status client‑side. The mapping below documents the canonical
ordering used by off‑chain consumers.

## Precedence order

When multiple flags could apply, the contract resolves status in this order:

1) **Completed**
2) **Deleted**
3) **Disputed**
4) **Open**
5) **CompletionRequested**
6) **Expired**
7) **InProgress**

## Status table (canonical mapping)

| Value | Name | Condition |
| --- | --- | --- |
| 0 | Deleted | `employer == address(0)` (cancel/delete representation). |
| 1 | Open | Employer set, no assigned agent. |
| 2 | InProgress | Assigned agent, no completion request, not completed, not disputed, not expired. |
| 3 | CompletionRequested | `completionRequested == true` and not completed, not disputed. |
| 4 | Disputed | `disputed == true` and not completed. |
| 5 | Completed | `completed == true`. |
| 6 | Expired | Assigned agent, `expireJob` called (flag set), not completed, not disputed, no completion request. |

## Notes

- **Deleted** is used for cancelled/deleted records and does not imply any on-chain settlement beyond the cancel path.
- **Expired** is computed and **informational** unless an explicit expiry/settlement function is called.
- **Expired** is still time‑derived off‑chain by comparing `assignedAt + duration` to the latest block timestamp, but the on‑chain flag only flips after `expireJob`.
