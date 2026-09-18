# Deriving job status without confusing it with payment

Use `getJobCore` and `getJobValidation`. Current getters do not return a numeric lifecycle enum. Cancelled/deleted jobs revert with `JobNotFound`; identify their history through `JobCancelled` rather than inventing a readable empty record.

| Display status | Condition, in order |
| --- | --- |
| Settled | `completed` is true; includes an agent win or buyer refund |
| Expired / neutral refund | `expired` is true; inspect `JobExpired` or `UnresolvedDisputeRefunded` |
| Disputed | `disputed` is true |
| Completion requested | `completionRequested` is true |
| Open | Assigned agent is the zero address |
| Assigned | An agent is assigned and no later state applies |

A deadline passing does not change the contract state. Show an eligible action such as **Expire and return escrow** separately; the job becomes terminal only after a successful transaction. Submitted work cannot use the non-delivery expiry path, even if its URI contains no useful work.

Use `getJobDeadlines` for live, pause-adjusted dates. Do not infer payment from a status badge: inspect the actual outcome events and USDC transfers. Failed outgoing payments remain reserved in `pendingUSDC`; settlement can be complete while receipt of money is delayed.
