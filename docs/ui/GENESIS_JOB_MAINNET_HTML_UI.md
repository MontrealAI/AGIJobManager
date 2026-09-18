# USDC standalone console v1.0.0

Use the [v1.0.0 console](https://github.com/MontrealAI/AGIJobManager/releases/download/v1.0.0/agijobmanager-usdc.html) with a verified v0.9.6 or v1.0.0 USDC manager on Ethereum mainnet. No manager is configured by default. A verified v0.9.6 instance does not need redeployment for this update.

The [matching repository console](../../ui/agijobmanager-usdc.html) includes clear cost and buyer guidance and requires `getJobBonds` for voting. v0.9.5 and older managers do not have that getter. See [compatibility and verification](../qualification/BUYER_ECONOMICS_FOLLOWUP.md), including the older console's bond-quote limitation. Existing jobs remain on their original contracts.

Before enabling writes the console checks chain ID 1, contract code, the manager's immutable `usdcToken()` address and six decimals. It repeats these checks before each transaction. Token identity checks do not prove source correctness; verify the deployment independently first.

All amounts use USDC with at most six decimal places. Excess precision is rejected. Approval, escrow, bonds, settlement and withdrawals use the same USDC address. The old bridge/vault panel is retired, and saved forms and wallet context retain the v0.9.6 namespace because the ABI and executable bytecode are unchanged. The console still rechecks account, chain and manager before writing. Pre-v0.9.6 saved context is not imported.

Wallet/account/chain changes invalidate reviews and write eligibility. Review the exact amount and spender before signing; USDC approval is separate from a job transaction. ETH is required only for gas.

See [the migration guide](../USDC_MIGRATION.md) for supported chains, default economics, transfer restrictions and deployment steps. Prior consoles remain in the v0.4.0 Git tag for historical operations.
