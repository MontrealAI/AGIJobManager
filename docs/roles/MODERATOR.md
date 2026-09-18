# Moderator Guide — v0.9.5

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

An outgoing USDC transfer failure reserves that payment for its original recipient; other eligible recipients can still be paid and the job can settle. Check `pendingUSDC(recipient)` and actual transfers, then retry `claimUSDC(recipient)` when USDC permits it. Do not submit a second resolution for an already settled job. ENS hook failure alone need not undo settlement.

After `getJobDeadlines(jobId).ownerResolutionAfter` has strictly passed, the owner can use `resolveStaleDispute(jobId, employerWins)`. This is a separate privileged recovery path. Read current timers and the [owner controls](../OWNER_CONTROLS.md).

You cannot adjudicate a job where you are a party, voter, or recorded validator controller. Use `getJobDeadlines` for the pause-adjusted owner and neutral refund deadlines. After two unpaused dispute review periods, anyone can return the buyer escrow and each contributor's own bonds without deciding quality. Decide disputed evidence before that timeout if an adjudicated payout is warranted. Buyer wins refund the full escrow; failed outgoing transfers become claims, so verify pending payments separately.
