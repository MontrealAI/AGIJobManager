# Deployment and operations

> Current guide for this source checkout. See [release identity and deployment commands](RELEASE_GUIDE.md).

The supported public-network workflow is documented in the [Hardhat guide](../hardhat/README.md) and [deploy day runbook](DEPLOY_DAY_RUNBOOK.md). Root Truffle deployment/signing commands are retired for public networks.

- Settlement uses native Circle USDC with six decimals.
- Successful jobs pay validators first, 30% of original job cost to wallet 1, 10% to wallet 2, and the remaining balance to the agent.
- Deployment requires both recipient addresses and leaves intake paused for configuration.
- Ownership changes require acceptance by the proposed owner.
- Recipient rotation requires paused intake and no outstanding escrow or bonds.
- The contract is non-upgradeable. A verified v0.9.6 manager remains compatible with the v1.0.3 console; first deployments and moves from incompatible older versions require a fresh manager.

Read the [owner control matrix](OWNER_CONTROLS.md), [USDC migration guide](USDC_MIGRATION.md), [payout specification](USDC_PAYOUT_SPLIT.md) and [dependency security scope](DEPENDENCY_SECURITY.md) before deployment.
