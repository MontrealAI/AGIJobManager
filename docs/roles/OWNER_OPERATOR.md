# Owner/Operator Guide — v1.0.3

Use the [owner controls](../OWNER_CONTROLS.md) for the full operation and restriction matrix. The [USDC console](../../ui/agijobmanager-usdc.html) exposes guarded owner actions and ownership acceptance.

To admit agents using the free `*.alpha.agent.agi.eth` name + soulbound NFT, follow the [root, collection and readiness walkthrough](../NFT_POLICY.md#enable-the-free-alpha-agent-identity-route). Registration alone does not configure your manager.

## What remains fixed

The deployed contract has no implementation upgrade switch. Its native USDC address and the successful-job 30%/10% shares are fixed. Agents receive the remainder after the posted validator budget and those two shares; NFT eligibility scores do not change payout percentages.

## Core operations

| Operation | Key restriction |
| --- | --- |
| Commission a fresh deployment | Intake starts paused; verify configuration and ownership before enabling jobs |
| Pause intake | `pause`/`pauseIntake` block posting and application; existing settlement actions can continue |
| Pause settlement | `setSettlementPaused(true)` blocks completion, voting, disputes, and settlement as well as intake; `pauseAll` pauses both lanes |
| Change validator reward budget | `setValidationRewardPercentage(1..60)` affects only newly posted jobs |
| Change bond parameters | Agent bond is fixed at assignment; validator bond is fixed by the first vote on that job |
| Change thresholds, quorum, review/challenge periods, or slash percentage | All four escrow/bond reserve counters must be zero |
| Rotate payout wallets | Intake must be paused and all live job escrow and bonds zero; recipients must be distinct and valid |
| Manage allowlists, blacklists, moderators, and NFT credentials | NFT default changes affect future postings; collection changes require zero live job escrow and bonds. Other role/eligibility changes remain live |
| Withdraw USDC | Intake paused, settlement enabled, and amount no greater than `withdrawableUSDC()`; reserved funds are unavailable |
| Transfer ownership | `transferOwnership` proposes; the proposed wallet must call `acceptOwnership` |

`renounceOwnership` is disabled. A duration limit must be positive and at most 365 days. Identity configuration can be locked irreversibly; inspect the detailed guide before locking it. Parameter maintenance is not an upgrade of deployed code.

Use a suitably secured owner wallet, review network/address and previews, and maintain ETH for gas. Settlement wallet changes take effect only between jobs; they cannot redirect outstanding reserves. Owner deposits are not required for normal successful-job payouts because the original job cost is fully allocated.

Monitor `lockedEscrow`, `lockedAgentBonds`, `lockedValidatorBonds`, `lockedDisputeBonds`, both pause states, `owner`, and `pendingOwner`. Relevant events include `SettlementPauseSet`, `SettlementWalletsUpdated`, `ValidationRewardPercentageUpdated`, `USDCWithdrawn`, and ownership events. There is no reward-pool contribution API in the current contract.
