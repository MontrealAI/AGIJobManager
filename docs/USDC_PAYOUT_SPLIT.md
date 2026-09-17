# v0.9.0 — USDC job distribution

Jobs are posted and fully escrowed in native Circle USDC. A successful completion distributes the original job cost in this order, in one atomic transaction:

| Recipient | Share of the original job cost | Example: 100 USDC |
| --- | --- | --- |
| Correct-side validators | Job's validator budget, 8% by default | 8 USDC |
| `wallet30()` | 30% | 30 USDC |
| `wallet10()` | 10% | 10 USDC |
| Assigned agent | All remaining USDC | 52 USDC |

The two wallet shares are calculated from the **original escrowed job cost**, not the balance remaining after validator rewards. They are included in that cost, not additional charges. All amounts use six decimal places; one USDC is `1000000` base units. ETH is still needed for Ethereum gas.

## Validator terms and exact accounting

- `validationRewardPercentage` defaults to 8 and may be set by the owner to an integer from 1 through 60. The rate is frozen for each job in `createJob`, before assignment. Later changes affect only new jobs.
- `getJobCore(jobId).agentPayoutPct` is the base agent percentage (`60 - snapshotted validator rate`). It does not depend on NFT scores. It may be zero at the 60% validator-budget limit.
- For job cost `P`, `W30 = floor(P * 30 / 100)` and `W10 = floor(P * 10 / 100)`. With participating validators, `V = floor(P * snapshotted rate / 100)`; with no validators, `V = 0`. The agent base payment is `P - V - W30 - W10`.
- Correct-side validators divide the reward pool under the existing vote, bond and slashing rules. Any unallocated reward pool, including integer-division dust, goes to the agent on an agent win. No successful-job cost remains in treasury.
- Bonds are separate from the job cost. Agent and dispute bonds are returned/routed under the existing outcome rules. Incorrect validator bonds can be slashed into the reward pool. `JobPayoutDistributed.agentAmount` includes residual validator-pool dust (which can include slashed bonds); agent/dispute bond transfers follow separately.
- With no validator votes, the existing review-window fallback still completes in favor of the agent: 30% / 10% / 60%, with no validator payment. This fallback is not evidence of independent validation.
- Cancellations, expiry, and employer-win dispute outcomes pay **no 30% or 10% wallet shares**. Employer-win refunds retain the existing correct-side validator reward and bond rules.

Every transfer is atomic with settlement. If USDC is paused, a recipient is blocked, or another transfer fails, the transaction reverts all prior transfers and state changes. The same job can be retried after the restriction is resolved. Double settlement is rejected.

## Required wallet configuration

The constructor takes a sixth argument, `address[2] settlementWallets`, in this order:

1. The wallet receiving 30% of every successful job's original cost.
2. A different wallet receiving 10%.

Both addresses are required, nonzero, distinct, and cannot be the manager itself or the USDC token contract. In v0.9.0 the owner can rotate them with `setSettlementWallets`, but only while intake is paused and every outstanding job escrow and bond reserve is zero. Existing jobs cannot be redirected. Choose addresses controlled by the intended recipients and verify their ability to receive USDC before deployment. Follow the [owner rotation and ownership handover guide](OWNER_CONTROLS.md). USDC and the 30% / 10% shares remain fixed.

No recipient addresses were supplied for this software release. `hardhat/deploy.config.example.js` therefore leaves both entries empty and deployment fails until real addresses are provided. `config/usdc-deployment.json` remains `deployment-required`, with no live manager configured. Do not substitute the deployer, owner, a test address, or a historical deployment receipt.

## Fresh deployment and migration

1. Use the [USDC deployment guide](USDC_MIGRATION.md) and [Hardhat deployment instructions](../hardhat/README.md). Fill `settlementWallets: ["0x...30percent", "0x...10percent"]` with actual reviewed addresses, alongside the owner, ENS and identity configuration. Those strings illustrate the order and are not valid addresses.
2. Rehearse on Sepolia with test USDC. Verify `usdcToken()`, `wallet30()`, `wallet10()`, six decimals, compiler settings, linked libraries and the full constructor arguments.
3. For Ethereum mainnet, use Circle's native USDC at `0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48`. See [Circle's registry](https://developers.circle.com/stablecoins/usdc-contract-addresses).
4. After a separately authorized deployment, record its receipt, update the deployment registry, regenerate the interfaces and verify a small complete job lifecycle before wider use.
5. Close existing jobs on their original contracts and under their original economics. v0.9.0 cannot upgrade earlier immutable contracts, migrate escrow, or reuse old approvals.

The interfaces require the v0.9.0 wallet and pending-owner getters and canonical USDC before enabling writes, display both recipient addresses, and use new browser storage namespaces. Token/network/getter checks complement source and bytecode verification; they do not authenticate arbitrary contracts supplied by a user.

## Compatibility

- v0.9.0 retains the v0.8.0 contract API and economics. The successful-job split was introduced in v0.6.0; guarded wallet rotation and two-step ownership were introduced in v0.7.0. `transferOwnership` proposes a handover, `acceptOwnership` completes it, and renunciation is disabled. `PlatformRevenueAccrued` remains retired.
- Existing `AGIType.payoutPercentage` / `getHighestPayoutPercentage` names remain for compatibility as NFT eligibility scores only. Positive registered NFT holdings are still required to apply; these scores do not affect payment amounts.
- `withdrawableUSDC()` can expose unreserved donations. It does not retain any successful-job cost and still protects outstanding escrow and bonds.
- Previous releases and their exact economics remain available through immutable Git tags. No live contract was deployed by this software release.

## Verification

`test/ownerControls.test.js` covers authorized rotation, invalid recipients, outstanding escrow protection, two-step authority, proposal replacement/cancellation and disabled renunciation. Payout tests also cover future-job rotation and malicious owner reentrancy from the completion NFT callback.

`test/payoutSplit.test.js` covers transfer order, 8/30/10/52 allocation, posting-time snapshots, recipient validation, rate limits, micro-USDC rounding, no-vote completion, cancellation/refund exclusions, rollback at every recipient, and double-settlement prevention. The existing lifecycle, dispute, escrow, security and UI suites also run against these semantics. Automated verification does not constitute an independent audit.
