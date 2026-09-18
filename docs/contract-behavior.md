# Contract behavior — v1.0.3

See [buyer protection](BUYER_PROTECTION.md) for a plain-language outcome table and [USDC distribution](USDC_PAYOUT_SPLIT.md) for arithmetic.

## Lifecycle

1. Buyer funds `createJob` in native USDC. `cancelJob` or owner `delistJob` returns full escrow only before assignment.
2. The first eligible agent calling `applyForJob` takes the job and posts the performance bond. ENS membership remains the normal admission route; the job's NFT requirement was fixed at posting.
3. The agent submits a nonempty completion URI with `requestJobCompletion` by the pause-adjusted assignment deadline. Without submission, anyone can `expireJob` strictly after that deadline, refunding full escrow plus forfeited agent bond to the buyer.
4. Independent eligible validators vote once per wallet, ENS credential and controller. Voting ends at `getJobDeadlines(jobId).reviewEnd`. The disapproval threshold opens a dispute; the approval threshold starts an additional challenge clock.
5. `finalizeJob` requires time strictly after `settlementAfter`: the later of full review end and any approval challenge end. No votes, under quorum or a tie opens a dispute. Otherwise the majority wins.
6. The buyer may instead `acceptJob` immediately for submitted, unsettled, undisputed work. This knowingly authorizes the successful-job split, bypasses further review and earns no agent/validator reputation.

## Disputes

Either party may post the quoted dispute bond and call `disputeJob` through the inclusive settlement cutoff. An eligible moderator can resolve a dispute with typed code `1` (agent wins), `2` (buyer wins), or `0` (no action). The owner may resolve strictly after `ownerResolutionAfter`. A party, recorded voter or recorded validator controller cannot adjudicate that job.

Strictly after `neutralRefundAfter`, anyone may call `refundUnresolvedDispute`: full escrow to buyer, every bond to its original contributor, and no reward, slash, fees, reputation or NFT. The job becomes expired and cannot settle again. This is a neutral timeout, not a quality judgment.

## Pauses, payments and receipts

Intake pause stops creation and assignment. Settlement pause also blocks all settlement-gated actions and freezes assignment, review, challenge and arbitration clocks. Use `getJobDeadlines`, not raw timestamp arithmetic. Settlement starts enabled; new deployments begin with intake paused.

Successful outcomes allocate the job's validator budget, 30% and 10% of original cost to the configured wallets, and the remainder to the agent. Buyer wins preserve the full escrow; validator rewards use forfeited collateral. Cancel/expiry/neutral refund pay no wallet fees.

Each outgoing transfer is attempted with a bounded gas budget. A failed attempt becomes `pendingUSDC(beneficiary)`, backed by `lockedClaims`. Anyone can retry `claimUSDC(beneficiary)` to that same address once settlement and USDC transfers are enabled. Claims cannot be redirected or withdrawn by the owner. Incoming escrow and bonds remain strict, exact, atomic transfers.

An agent-win completion issues the buyer an ERC-721 receipt using the completion URI or bounded optional ENS lookup. A completed job and its NFT prove the recorded outcome; check pending payments separately before treating every recipient as paid.

Explicit buyer acceptance does not slash dissenting validators or award reputation; it waives further review rather than adjudicating the truth of their votes. Normal adjudicated outcomes retain the configured slashing rules.
