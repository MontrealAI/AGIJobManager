# Happy path walkthrough — v0.9.4

A job moves from USDC funding through assignment and evidence review to an explicit settlement transaction. The moderator participates only if a dispute opens.

## Before you start

Verify the deployment and network in the [USDC console](../../ui/agijobmanager-usdc.html). Read `usdcToken()` and use native USDC with six decimals. Keep ETH for gas. Approve exact USDC amounts separately for the employer's escrow, the agent's performance bond, each validator's vote bond, and any manual dispute bond.

Agents need an identity route **and** an eligible AGI-type NFT credential. Validators need a validator identity route. For ENS, enter only the label, such as `helper`, under the configured root. An allowlist/Merkle route does not require an ENS name. See [roles](roles.md) and [proofs](merkle-proofs.md).

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
| Approval threshold reached, challenge window strictly elapsed, approvals exceed disapprovals | `finalizeJob` can complete an undisputed job before the full review window ends |
| Completion review strictly elapsed, zero votes | `finalizeJob` completes; no validator reward is charged, so the agent receives the remainder after 30%/10% |
| Review strictly elapsed, nonzero votes below quorum or tied | `finalizeJob` opens a dispute |
| Review strictly elapsed, quorum reached and approvals exceed disapprovals | `finalizeJob` completes |
| Review strictly elapsed, quorum reached and disapprovals exceed approvals | `finalizeJob` refunds under the employer-win reward/bond rules |
| Disapproval threshold reached, or a valid manual dispute | Moderator resolution is required; ordinary finalization is blocked |

The early approval path is checked first. When an approval threshold has already been reached, its challenge window must also strictly elapse before finalization, even if the completion review window ends first. A settled job cannot later be disputed. Monitor submissions promptly instead of assuming the full review period remains available after an approval threshold is reached.

## If disputed

The employer or assigned agent can post a manual dispute only after completion was requested, within the review window, and while the job remains unsettled and undisputed. Approve the dispute bond first.

A moderator calls `resolveDisputeWithCode(jobId, code, reason)` with `1` for agent success, `2` for employer win, or `0` to record a note without deciding. On employer win, validators/bonds may reduce or adjust the refund; the 30%/10% shares are not paid. After the stale-dispute timer strictly elapses (fourteen days by default), the owner may resolve with `resolveStaleDispute`.

## Other exits

- Before assignment, the employer may cancel and the owner may delist the job; escrow is refunded.
- After the assignment deadline, an assigned job with no completion request or active dispute can be expired by anyone. The employer receives escrow and the forfeited agent bond.
- Pauses and issuer USDC restrictions can temporarily prevent transactions. A failed settlement transfer rolls the whole transaction back; no participant receives a partial distribution.

For an error, use [common reverts](common-reverts.md). For the complete economic explanation, see [the user guide](../USERS.md).
