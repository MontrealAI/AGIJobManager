# Happy path walkthrough — v0.9.7

A job moves from USDC funding through assignment and evidence review to an explicit settlement transaction. The moderator participates only if a dispute opens.

## Before you start

Verify the deployment and network in the [USDC console](../../ui/agijobmanager-usdc.html). Read `usdcToken()` and use native USDC with six decimals. Keep ETH for gas. Approve exact USDC amounts separately for the employer's escrow, the agent's performance bond, each validator's vote bond, and any manual dispute bond.

Agents need an identity route and an eligible AGI-type NFT credential when the job's snapshotted NFT policy requires one. Validators need a validator identity route. For ENS, enter only the label, such as `helper`, under the configured root. An allowlist/Merkle route does not require an ENS name. See [roles](roles.md) and [proofs](merkle-proofs.md).

## Walk through a 100 USDC job

1. **Employer:** approve `100000000` USDC base units, then call `createJob` with the specification URI, total cost, duration in seconds, and details. Record the `JobCreated` ID.
2. **Agent:** read the required performance bond, approve it, and call `applyForJob`. The first successful eligible application assigns the job. There is no separate employer selection step.
3. **Agent:** deliver the work and call `requestJobCompletion` with its evidence/metadata URI by the assignment deadline.
4. **Validators:** review the evidence, approve their quoted bond, and each cast one `validateJob` or `disapproveJob` vote. One wallet cannot vote twice or switch its vote.
5. **Any caller:** when timing and outcome conditions below allow, call `finalizeJob`. This is a separate transaction; votes and elapsed time never automatically send payment.
6. **All participants:** verify events and USDC balances. With the default 8% budget and correct approval votes, validators share 8 USDC first, `wallet30` receives 30 USDC, `wallet10` receives 10 USDC, and the agent receives 52 USDC. Bonds and rounding are settled separately. The employer receives the completion NFT.

## When finalization is possible

Read actual deployment values; defaults are a one-day approval challenge and seven-day completion review.

| State | What happens |
| --- | --- |
| Approval threshold reached | Starts the challenge clock; ordinary payment still waits for the full review and requires quorum and majority |
| Full review and any longer challenge elapsed, zero votes | `finalizeJob` opens a dispute without paying the agent |
| Review strictly elapsed, nonzero votes below quorum or tied | `finalizeJob` opens a dispute |
| Review strictly elapsed, quorum reached and approvals exceed disapprovals | `finalizeJob` completes |
| Review strictly elapsed, quorum reached and disapprovals exceed approvals | `finalizeJob` refunds under the employer-win reward/bond rules |
| Disapproval threshold reached, or a valid manual dispute | Moderator resolution is required; ordinary finalization is blocked |

Ordinary finalization requires the full review and any longer approval challenge to end, plus quorum and a strict majority. No votes, under-quorum votes or a tie open a dispute. The buyer may explicitly accept submitted work immediately. Use `getJobDeadlines` for pause-adjusted dates; see [buyer protection](../BUYER_PROTECTION.md).

## If disputed

The employer or assigned agent can post a manual dispute only after completion was requested, through the displayed settlement cutoff, and while the job remains unsettled and undisputed. Approve the dispute bond first.

A moderator calls `resolveDisputeWithCode(jobId, code, reason)` with `1` for agent success, `2` for employer win, or `0` to record a note without deciding. On employer win, the full job escrow returns to the buyer; reviewer rewards use forfeited collateral; the 30%/10% shares are not paid. After the stale-dispute timer strictly elapses (fourteen days by default), the owner may resolve with `resolveStaleDispute`.

## Other exits

- Before assignment, the employer may cancel and the owner may delist the job; escrow is refunded.
- After the assignment deadline, an assigned job with no completion request or active dispute can be expired by anyone. The employer receives escrow and the forfeited agent bond.
- Pauses and issuer USDC restrictions can temporarily prevent transactions. A failed outgoing transfer becomes a protected claim; eligible recipients may still be paid. Retry the claim when transfers are permitted.

For an error, use [common reverts](common-reverts.md). For the complete economic explanation, see [the user guide](../USERS.md).

After two unpaused dispute review periods, anyone can invoke the neutral timeout to return escrow and each participant's own bond without penalties or rewards.
