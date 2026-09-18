# Buyer protection — v0.9.5

**Your job cost stays in escrow until an authorized outcome. No votes do not mean approval.** This release improves the contract rules; people still have to assess whether the work meets the agreed requirements.

| What happens? | What you can do | Money outcome |
| --- | --- | --- |
| Nobody has taken the job | Cancel it | Full job escrow returned |
| Agent misses the submission deadline | Anyone can expire the job after the deadline | Full job escrow and the agent's forfeited bond returned to the buyer |
| Submitted work is satisfactory | Buyer selects **Accept work and pay** | Immediate successful-job distribution; acceptance is final |
| Submitted work is poor or incomplete | Buyer opens a dispute before the displayed cutoff, posting the quoted dispute bond | An eligible moderator reviews the evidence; an owner backstop becomes available later |
| No votes, too few votes, or a tie | Anyone finalizes after the displayed deadline | Opens a dispute; agent is not paid automatically |
| Enough votes establish a majority | Anyone finalizes after the full review and any longer approval challenge | Majority determines agent win or buyer win |
| Buyer wins | Settlement can be triggered by the authorized decision | Full job escrow returned; no 30%/10% fees. Reviewer rewards come from forfeited collateral |
| Arbitration remains unanswered | Anyone selects **Return escrow and bonds** after the neutral refund deadline | Full buyer escrow and each participant's own bond returned; no fees, reward, penalty, reputation, or completion NFT |
| USDC cannot reach a recipient | Retry the reserved payment when USDC permits it | Entitlement stays reserved for the original recipient; other eligible payments can proceed |

## Dates you can rely on

Use `getJobDeadlines(jobId)` and the console's job details. Ordinary payment waits until **both** the full completion review and any approval challenge have ended. A party may dispute through that cutoff; validators must vote within the review window. The buyer's explicit acceptance and an eligible moderator's dispute decision are separate authorized settlement paths.

Settlement pauses stop the assignment, review, challenge and arbitration clocks. Intake-only pauses do not. Projected calendar dates extend while settlement is paused. With default settings, review is 7 unpaused days, an approval challenge is 1 unpaused day, the owner backstop opens after 14 unpaused dispute days, and neutral refund opens after 28. Check the actual deployment: the owner can change timing parameters only with no live job obligations.

## Before you post

Write specific deliverables, measurable acceptance criteria, a realistic duration, and accessible evidence requirements. The first eligible agent whose application succeeds takes the job automatically. Use smaller milestones as separate jobs for large or subjective work; this contract has no built-in partial payments or revision rounds. Keep enough ETH for gas and USDC for a possible dispute bond.

## Review independence and limits

The buyer and assigned agent cannot validate their own job. The same ENS credential or recorded controller cannot supply multiple votes through different wallets or names. A party, voter, or recorded validator controller cannot adjudicate that job as moderator or owner. These checks cannot prove that different wallets belong to different people; owner-managed allowlist and Merkle exceptions remain trusted admission routes.

Moderators still judge off-chain quality. A colluding reviewer group can vote incorrectly, and an unavailable moderator can leave an honest agent unpaid until the neutral refund returns the buyer's escrow. Bond sizes do not prove that cheating is unprofitable for every job. Owner pauses can delay all exits, and USDC issuer restrictions can delay payment. See [economics and operating limits](game-theory.md).

v0.9.5 requires a fresh manager and eight fixed linked libraries. Existing jobs, token allowances and ENS pages remain on their original contracts. Publishing this software does not activate it on Ethereum.

Explicit buyer acceptance does not slash dissenting validators or award reputation; it waives further review rather than adjudicating the truth of their votes. Normal adjudicated outcomes retain the configured slashing rules.
