# USDC standalone console v0.9.5

Open [the console](../../ui/agijobmanager-usdc.html). Configure the address of a newly deployed, source-verified v0.9.5 USDC manager on Ethereum mainnet. No manager is configured by default.

Before enabling writes the console checks chain ID 1, contract code, the manager's immutable `usdcToken()` address and six decimals. It repeats these checks before each transaction. Token identity checks do not prove source correctness; verify the deployment independently first.

All amounts use USDC with at most six decimal places. Excess precision is rejected. Approval, escrow, bonds, settlement and withdrawals use the same USDC address. The old bridge/vault panel is retired, and saved forms and wallet context use a new v0.9.5 namespace.

Wallet/account/chain changes invalidate reviews and write eligibility. Review the exact amount and spender before signing; USDC approval is separate from a job transaction. ETH is required only for gas.

See [the migration guide](../USDC_MIGRATION.md) for supported chains, default economics, transfer restrictions and deployment steps. Prior consoles remain in the v0.4.0 Git tag for historical operations.
