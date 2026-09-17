# Moderator Guide — v0.9.0

Moderators resolve active disputes through `resolveDisputeWithCode(jobId, resolutionCode, reason)`. The caller must be in the manager's `moderators` list and settlement must be enabled. Ownership alone does not grant this moderator role.

| Code | Effect |
| --- | --- |
| `0` — no action | Records the reason; leaves the dispute active |
| `1` — agent wins | Settles validators, the fixed 30%/10% gross-cost shares, and agent remainder in USDC; returns/awards bonds and mints the employer's completion NFT |
| `2` — employer wins | Settles validator rewards/bonds and refunds the employer under the contract rules; no 30%/10% shares or completion NFT |

The reason is public explanatory text. It does not select the outcome. The current contract has no legacy string-based `resolveDispute` function; use the numeric code.

## Resolve a dispute

1. Verify the deployment and active dispute in the [USDC console](../../ui/agijobmanager-usdc.html) or `getJobCore`/`getJobValidation` reads.
2. Review the employer's requirements, submitted work, and validator evidence.
3. Select the numeric outcome, review the USDC settlement preview, enter a clear reason, and sign with a moderator wallet. Have ETH for gas.
4. Confirm `DisputeResolvedWithCode`. Agent success additionally emits `JobPayoutDistributed`, `JobCompleted`, and `NFTIssued`. Read the terminal state and balances for employer-win refunds.

A failed USDC transfer reverts the entire resolution; it does not partially pay recipients. Settlement can be retried after the underlying transfer restriction is resolved. ENS hook failure alone need not undo settlement.

After `disputedAt + disputeReviewPeriod` has strictly passed, the owner can use `resolveStaleDispute(jobId, employerWins)`. This is a separate privileged recovery path. Read current timers and the [owner controls](../OWNER_CONTROLS.md).
