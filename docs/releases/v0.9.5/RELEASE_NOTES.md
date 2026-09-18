# v0.9.5 — Buyer protection and resilient USDC settlement

v0.9.5 closes the identified buyer-protection and settlement gaps and updates the console, deployment tools and user guides.

- **Full buyer escrow protection:** a buyer-win outcome returns the whole job escrow. Reviewer rewards come from forfeited collateral, with no 30%/10% wallet fees on refunds.
- **No automatic payment for unreviewed work:** no votes, under-quorum votes or a tie open a dispute. Ordinary settlement waits for the full review and any longer approval challenge.
- **Clear buyer acceptance:** “Accept work and pay” lets the buyer authorize satisfactory work immediately. Acceptance earns no reputation and does not slash dissenting reviewers.
- **Independent review checks:** job parties cannot validate their own work; an ENS credential or recorded controller cannot supply duplicate votes. Parties, voters and recorded validator controllers cannot adjudicate that job.
- **Fairer timing and an exit:** settlement pauses stop lifecycle clocks. After two unpaused dispute-review periods, anyone can return buyer escrow and each contributor's own bonds without judging quality.
- **Recoverable USDC payments:** a failed outgoing transfer becomes a protected claim for its original recipient. Eligible recipients can still be paid; blocked payments can be retried when USDC permits them.
- **Updated operations:** exact deadline displays, payment retry, eight-library deployment and verification, claim-aware readiness checks, and simpler buyer and operator guidance.

Successful-job shares remain 8% by default for validators, 30% and 10% for the configured wallets, and the remainder for the agent. ENS Agent/Club membership and the per-job NFT policy are preserved. Explicit owner-managed admission exceptions remain part of the trust model.

## Validation

The release is pinned to application commit `236d8789f0df4a8acae238d7b319bf01074ecef9`. The archive includes source CI evidence, checksums and the validation record. Checks cover contract regressions, unit/fuzz/invariant tests, actual USDC and ENS fork rehearsals, deployment limits, documentation and browser behavior. Static analysis retains 115 reviewed observations: 0 high, 9 medium, 36 low and 70 informational. This is internal qualification, not an independent audit or a claim of flawlessness.

## Deployment and limits

**A fresh deployment is required.** Existing USDC and original-asset jobs remain on their original contracts, with their original token allowances, interfaces and ENS namespaces. No public Ethereum transactions are part of this release.

Verify the actual owner acceptance, recipient control, ENS authority, NFT policy, runtime bytecode and operational rehearsal before activating a production instance. Reviewers and moderators still assess off-chain quality. Undisclosed common control can defeat independence assumptions, unavailable arbitration can leave honest work unpaid, owner pauses can delay exits, and USDC issuer restrictions can delay receipt of reserved payments.

Start with [the buyer guide](https://github.com/MontrealAI/AGIJobManager/blob/v0.9.5/docs/BUYER_PROTECTION.md) and [Hardhat deployment guide](https://github.com/MontrealAI/AGIJobManager/blob/v0.9.5/hardhat/README.md).
