# Configuration Reference — v0.9.4

The maintained [configuration catalog](CONFIGURATION.md) contains every current setter, guard, default and snapshot rule. Use [owner controls](OWNER_CONTROLS.md) for reviewed transaction procedures and the [Hardhat guide](../hardhat/README.md) for public-network deployment.

## Core rules

- Native USDC and the successful-job 30%/10% gross-cost shares are fixed. The deployment has no implementation upgrade switch.
- The validator budget is 1–60% (default 8%), fixed for each job when posted. NFT scores establish eligibility only; there is no NFT-plus-validator percentage-sum rule.
- Agent bonds are fixed at assignment; each job's validator bond is fixed by its first vote. Subsequent owner changes do not rewrite those amounts.
- Threshold, quorum, review/challenge period and slash changes require all four escrow/bond reserves to be zero. Recipient rotation additionally requires intake paused.
- `jobDurationLimit` must be positive and at most 365 days. Review/challenge periods are also positive and at most 365 days.
- `lockIdentityConfiguration()` permanently freezes protected ENS/root wiring setters. USDC is already immutable; Merkle roots and other permitted operating controls remain owner-managed.
- `withdrawUSDC` requires intake paused and settlement enabled, and cannot exceed `withdrawableUSDC()`. All escrow, agent, validator and dispute bonds remain reserved.
- Ownership changes require proposal and acceptance. Renunciation is disabled; fresh deployments start with intake paused.

## Change management

Verify the network, deployed address, owner and exact current settings. Read the catalog's guard for the action, preview it in the [USDC console](../ui/agijobmanager-usdc.html), and verify the resulting state/event after confirmation. Use wallet/Etherscan owner operations; public-network Truffle signing is retired.

## References

- [Contract source](../contracts/AGIJobManager.sol)
- [Configuration catalog](CONFIGURATION.md)
- [Owner controls](OWNER_CONTROLS.md)
- [Mainnet readiness](MAINNET_READINESS.md)
