# Protocol flow and accounting — v0.9.7

Read [contract behavior](contract-behavior.md) for transitions and [USDC distribution](USDC_PAYOUT_SPLIT.md) for exact shares.

## Reserves

`withdrawableUSDC = USDC balance - lockedEscrow - lockedAgentBonds - lockedValidatorBonds - lockedDisputeBonds - lockedClaims`.

The five reserves protect live job escrow, agent performance bonds, validator vote bonds, dispute bonds, and deferred recipient payments. Owner withdrawals require paused intake and enabled settlement and may use only surplus. Rotating wallets requires zero live escrow/bond obligations; existing claims keep their original beneficiary even after rotation.

| Terminal outcome | Job escrow | Agent bond | Validator bonds | Dispute bond | Completion NFT |
| --- | --- | --- | --- | --- | --- |
| Agent win | Recorded validator budget, 30% wallet, 10% wallet, remainder to agent | Returned | Correct approvals: bond plus rewards; incorrect votes: unslashed amount | Agent | Yes |
| Buyer win | Full escrow to buyer | Funds reviewer budget up to forfeited bond; unspent remainder to buyer | Correct disapprovals: bond plus collateral-funded rewards; incorrect votes: unslashed amount | Buyer | No |
| Missed submission deadline | Full escrow to buyer | Forfeited to buyer | None | None | No |
| Cancel/delist before assignment | Full escrow to buyer | None | None | None | No |
| Unanswered arbitration timeout | Full escrow to buyer | Returned | Each returned in full | Original contributor | No |

Any failed outgoing transfer becomes a protected claim; the entitlement in the table is unchanged. An issuer pause or blocklist can still prevent receipt of the funds until the issuer restriction is resolved.

## Review and deadlines

The approval threshold starts the challenge clock; it cannot shorten the full completion review. Ordinary finalization after `settlementAfter` requires quorum and a strict majority to pay either side. No votes, under-quorum votes and ties open disputes. Buyer acceptance is explicit and immediate. Settlement pauses extend every active lifecycle deadline.

Moderator arbitration, owner stale arbitration and neutral timeout use the [documented dispute rules](BUYER_PROTECTION.md). Quality is assessed off-chain; ENS credentials do not certify performance.

## Events to monitor

Monitor `JobCreated`, `JobApplied`, `JobCompletionRequested`, `ValidatorCredentialUsed`, `JobValidated`, `JobDisapproved`, `JobApprovalThresholdReached`, `JobDisputed`, `JobAccepted`, `DisputeResolvedWithCode`, `UnresolvedDisputeRefunded`, and terminal job events. For money, reconcile `JobPayoutDistributed`, `USDCDeferred`, `USDCClaimed`, token transfers, all five reserves and `withdrawableUSDC`. `NFTIssued` alone does not prove that every transfer succeeded.
