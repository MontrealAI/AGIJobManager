# Deployment and operations — v0.7.0

The supported public-network workflow is documented in the [Hardhat guide](../hardhat/README.md) and [deploy day runbook](DEPLOY_DAY_RUNBOOK.md). Root Truffle deployment/signing commands are retired for public networks.

- Settlement uses native Circle USDC with six decimals.
- Successful jobs pay validators first, 30% of original job cost to wallet 1, 10% to wallet 2, and the remaining balance to the agent.
- Deployment requires both recipient addresses and leaves intake paused for configuration.
- Ownership changes require acceptance by the proposed owner.
- Recipient rotation requires paused intake and no outstanding escrow or bonds.
- The contract is non-upgradeable; use a fresh deployment for v0.7.0.

Read the [owner control matrix](OWNER_CONTROLS.md), [USDC migration guide](USDC_MIGRATION.md), [payout specification](USDC_PAYOUT_SPLIT.md) and [dependency security scope](DEPENDENCY_SECURITY.md) before deployment.
