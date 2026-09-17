# v0.6.0 — USDC job payout distribution

Jobs are posted and paid in native Circle USDC. Successful completion distributes the original escrowed job cost in one atomic transaction:

| Payment order | Recipient | Share | Example: 100 USDC |
| --- | --- | --- | --- |
| 1 | Correct-side validators | 8% default | 8 USDC |
| 2 | First settlement wallet | 30% | 30 USDC |
| 3 | Second settlement wallet | 10% | 10 USDC |
| 4 | Assigned agent | Remaining balance | 52 USDC |

The 30% and 10% shares use the **original job cost**, not the post-validator balance. These shares are included in the employer's escrow, not added on top.

## Changes

- Two distinct immutable recipients, exposed by `wallet30()` and `wallet10()`, are required in the new sixth constructor argument `address[2] settlementWallets`. Zero, identical, manager-self and USDC-token recipients are rejected.
- The validator rate defaults to 8%, is restricted to 1–60%, and is snapshotted when the employer posts the job. Later owner changes affect only new jobs.
- The agent receives all remaining USDC, including unallocated validator rewards and rounding. A no-vote liveness completion pays 30% / 10% / 60%; no successful-job cost remains in treasury.
- Bond returns and slashing remain separate from the original job cost. Refunds, cancellations, expiry and employer-win disputes do not take the two wallet shares.
- NFT scores remain eligibility credentials; they no longer determine monetary payout shares.
- `JobPayoutDistributed` replaces `PlatformRevenueAccrued`. Interfaces verify and display both recipients, reject older managers and preview the new split using posting-time terms.
- Regression coverage checks transfer order, micro-USDC conservation, rate snapshots, refund exclusions, double-settlement rejection and full rollback when any recipient is blocked.

## Deployment and compatibility

**A fresh v0.6.0 manager deployment with both real recipient addresses is required. No live deployment or upgrade is performed by this release.** No wallet addresses were supplied, so the deployment example intentionally leaves them blank and rejects deployment until completed. Existing contracts, jobs, funds and approvals remain on their original contracts.

Ethereum mainnet settlement uses Circle's official six-decimal USDC at `0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48`. ETH remains necessary for gas. Sepolia uses Circle's test USDC; local fixtures have no financial value. USDC issuer controls can block a transfer; all settlement transfers and state changes then revert together.

Read the [v0.6.0 payout and deployment specification](https://github.com/MontrealAI/AGIJobManager/blob/v0.6.0/docs/USDC_PAYOUT_SPLIT.md) and the attached validation evidence.

## Downloads

- **AGIJobManager-v0.6.0-COMPLETE.zip** — pinned source, USDC console, release guidance and evidence.
- **agijobmanager-usdc.html** — standalone USDC console.
- **RELEASE_MANIFEST.json** — source identity and per-file SHA-256 inventory.
- **SHA256SUMS.txt** — download integrity checks.

Publication requires successful contract, UI, documentation and security CI for the exact source commit, reproducible archives and verified GitHub asset digests. Automated tests/static analysis are not an independent audit or certification of a live deployment.
