# Legacy mainnet snapshot migration — retired procedure

This page preserves the provenance of the earlier snapshot-based migration for the recorded legacy address `0x0178B6baD606aaF908f72135B8eC32Fc1D5bA477`. Its Truffle deployment and signing procedure is retired and must not be used for v0.9.3.

## Historical artifacts

- Read-only snapshot extractor: [`scripts/snapshotLegacyConfig.mainnet.js`](../scripts/snapshotLegacyConfig.mainnet.js).
- Committed snapshot: [`migrations/legacy.snapshot.mainnet.0x0178B6baD606aaF908f72135B8eC32Fc1D5bA477.json`](../migrations/legacy.snapshot.mainnet.0x0178B6baD606aaF908f72135B8eC32Fc1D5bA477.json).
- Retired migration entry point: [`migrations/2_deploy_agijobmanager_from_legacy_mainnet.js`](../migrations/2_deploy_agijobmanager_from_legacy_mainnet.js).
- Earlier instructions remain available in [the v0.9.0 historical document](https://github.com/MontrealAI/AGIJobManager/blob/v0.9.0/docs/MAINNET_MIGRATION_FROM_LEGACY.md); their commands are not current deployment instructions.

The snapshot is historical state evidence. It is not an approved source of current token units, settlement wallets, owner authority, live jobs or escrow balances.

## Current migration path

Follow the [USDC migration guide](USDC_MIGRATION.md) and [Hardhat deployment guide](../hardhat/README.md). Existing jobs and balances remain on their original contracts; the current manager does not import their escrow or approvals.

Prepare a fresh configuration using native six-decimal USDC, explicitly reviewed identity settings, and two distinct settlement wallets ordered 30% then 10%. Review monetary limits in USDC base units. Rehearse the deployment, verify the linked source and runtime, and complete two-step ownership acceptance while intake remains paused. The [owner controls](OWNER_CONTROLS.md) and [mainnet readiness guide](MAINNET_READINESS.md) describe the remaining operational checks.
