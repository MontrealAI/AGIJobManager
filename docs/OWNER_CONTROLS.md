# v0.9.2 owner controls

Jobs settle in native Circle USDC: validators first, then 30% and 10% of the original job cost to the two configured wallets, then the remaining amount to the agent. At the default validator budget of 8%, a successful 100 USDC job distributes 8 / 30 / 10 / 52 USDC. See the [complete payout rules](USDC_PAYOUT_SPLIT.md) for rounding, no-vote completion and refunds.

## What the owner can change

| Control | Boundary |
| --- | --- |
| Two payout wallet addresses | `setSettlementWallets(recipient30, recipient10)` requires paused intake and zero outstanding job escrow, agent bonds, validator bonds and dispute bonds. It cannot redirect an existing job. |
| Validator reward percentage | Integer 1–60%; default 8%. Each job fixes its rate at posting. Changes apply only to new jobs. |
| Ownership | Current owner proposes; only the proposed owner can accept. Renunciation is disabled. |
| Review periods, challenge period, voting thresholds, quorum and slashing percentage | Existing guards require all outstanding escrow and bonds to be settled before these terms can change. |
| Job duration limit | 1–31,536,000 seconds (365 days); this prevents deadline overflow from unsafe owner configuration. |
| Bond parameters, other job limits, eligibility and moderators | Available under the existing owner controls. Review the generated contract interface and simulate each change. Changes may affect future assignments, first votes or eligibility checks on posted jobs. |
| Intake and settlement pauses | Separate controls. An intake pause still permits completion and refunds. A settlement pause also stops those operations. |
| USDC and the 30% / 10% shares | Fixed in the contract. The owner cannot replace USDC or change those percentages. |
| Contract implementation | No proxy upgrade function. A new implementation requires a fresh deployment. |

The owner remains a trusted administrator for pauses, eligibility, moderators and stale-dispute decisions. Two-step ownership prevents an accidental immediate handover; it does not remove this trust. Use a suitably secured owner wallet, such as a multisignature account with tested signing and recovery procedures.

## Rotate payout wallets

1. Open the v0.9.2 USDC console, select the verified manager and connect as its owner. Confirm the network, manager and current wallet addresses.
2. Choose **pauseIntake**. Keep settlement enabled so existing jobs can finish or be refunded.
3. Settle, cancel or otherwise close every outstanding job through its normal lifecycle. Read `lockedEscrow`, `lockedAgentBonds`, `lockedValidatorBonds` and `lockedDisputeBonds`; all four must be zero.
4. Choose **Update payout wallets**. Enter the 30% recipient first and the 10% recipient second. Both must be distinct, nonzero, and different from the manager and USDC contract. Verify control of the addresses and their ability to receive USDC before submitting.
5. Review the simulation and transaction. Verify `SettlementWalletsUpdated`, `wallet30()` and `wallet10()` afterward, then choose **unpauseIntake**.

There is no extra per-job wallet snapshot storage cost: rotation is prohibited while any job funds remain reserved. Historical recipients can be reconstructed from configuration events and USDC transfer events; the wallet getters show the current configuration. A blocked recipient on an outstanding job must be resolved before that job can settle. This control does not bypass USDC issuer restrictions or reroute existing escrow.

## Transfer ownership

1. The current owner chooses **Propose new owner**, entering the intended recipient. The recipient appears as `pendingOwner()`. Administrative authority remains with `owner()`.
2. The proposed owner independently verifies the manager and connects with that address, then chooses **Accept ownership** (`acceptOwnership()`). A multisignature owner executes this call through its own signing interface.
3. Verify `owner()` equals the recipient, `pendingOwner()` is zero, and `OwnershipTransferred` records the handover. The previous owner can no longer administer the manager.

Before acceptance, the current owner can replace a proposal or cancel it with `transferOwnership(address(0))`. Cancellation does not renounce ownership. `renounceOwnership()` always reverts so a pause or maintenance task cannot be made permanently inaccessible through renunciation.

## Fresh deployment

The manager constructor starts intake paused atomically on every supported network. No job can enter between deployment and a later pause transaction. The Hardhat deployment script verifies this initial state and never opens intake. If the intended final owner differs from the deployer, it proposes a transfer and records the actual owner, pending owner and whether acceptance is still required. **A proposal is not a completed handover.** The deployer retains authority until the intended owner accepts.

Before opening intake: verify source and linked libraries, accept ownership where required, configure identity and operational parameters, verify the two recipients, and rehearse the lifecycle on Sepolia. After a separately authorized mainnet deployment, the owner can unpause intake when configuration is complete. This software release deploys no live contract and supplies no recipient wallet addresses.

Before opening a new deployment, run the read-only [deployment readiness check](../hardhat/README.md). See [mainnet qualification and remaining deployment gates](MAINNET_READINESS.md).
