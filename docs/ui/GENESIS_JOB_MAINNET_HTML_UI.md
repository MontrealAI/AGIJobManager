# USDC standalone console v0.9.6

For a v0.9.6 manager, use the [published v0.9.6 console](https://github.com/MontrealAI/AGIJobManager/releases/download/v0.9.6/agijobmanager-usdc.html). Configure a newly deployed, source-verified USDC manager on Ethereum mainnet. No manager is configured by default.

The [matching repository console](../../ui/agijobmanager-usdc.html) includes clear cost and buyer guidance and requires `getJobBonds` for voting. v0.9.5 and older managers do not have that getter. See [compatibility and verification](../qualification/BUYER_ECONOMICS_FOLLOWUP.md), including the older console's bond-quote limitation. Existing jobs remain on their original contracts.

Before enabling writes the console checks chain ID 1, contract code, the manager's immutable `usdcToken()` address and six decimals. It repeats these checks before each transaction. Token identity checks do not prove source correctness; verify the deployment independently first.

All amounts use USDC with at most six decimal places. Excess precision is rejected. Approval, escrow, bonds, settlement and withdrawals use the same USDC address. The old bridge/vault panel is retired, and saved forms and wallet context use a new v0.9.6 namespace. Previous saved manager addresses, wallet context and forms are not imported: configure the fresh verified manager explicitly.

Wallet/account/chain changes invalidate reviews and write eligibility. Review the exact amount and spender before signing; USDC approval is separate from a job transaction. ETH is required only for gas.

See [the migration guide](../USDC_MIGRATION.md) for supported chains, default economics, transfer restrictions and deployment steps. Prior consoles remain in the v0.4.0 Git tag for historical operations.
