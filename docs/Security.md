# Security — v0.9.4

The authoritative current settlement rules are in [USDC payout distribution](USDC_PAYOUT_SPLIT.md). Successful jobs pay validators (8% default), then 30% and 10% of the original USDC job cost to two configured wallets, then the remaining amount to the agent. Validator terms are fixed at posting; NFT eligibility scores do not set payout shares. No successful-job cost remains in treasury.

- [Deployment and cutover](USDC_MIGRATION.md): a fresh manager and two real recipient addresses are required.
- [Protocol flow and escrow accounting](PROTOCOL_FLOW.md): completion, refunds, bonds and disputes.
- [Generated contract interface](REFERENCE/CONTRACT_INTERFACE.md): current functions and constructor.
- [Generated events and errors](REFERENCE/EVENTS_AND_ERRORS.md): current ABI reference.

`setValidationRewardPercentage` accepts 1–60 and changes only newly posted jobs. The USDC address is immutable. Settlement wallets can be rotated only while intake is paused and all escrow and bonds are settled; see [owner controls](OWNER_CONTROLS.md). `withdrawUSDC` requires intake pause, unpaused settlement and surplus beyond all locked escrow and bonds. Issuer transfer restrictions revert the entire settlement; there is no partial payment or automatic recipient replacement.

Previous detailed instructions that describe NFT-based payout shares or retained job-cost revenue are historical and remain in [v0.5.0](https://github.com/MontrealAI/AGIJobManager/tree/v0.5.0). Do not use them to configure v0.9.4.
