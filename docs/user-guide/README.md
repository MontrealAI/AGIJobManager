# User guide — v1.0.3

Start with the [main user guide](../USERS.md) for USDC amounts, the fixed 30%/10% shares, required bonds, and a complete job lifecycle.

## Choose your next step

1. [Roles and permissions](roles.md)
2. [Happy path walkthrough](happy-path.md)
3. [Common reverts and fixes](common-reverts.md)
4. [Merkle proof guidance](merkle-proofs.md)
5. [Glossary](glossary.md)

Use the [USDC console](../../ui/agijobmanager-usdc.html) or the verified deployment's Etherscan Read/Write interface. The [operator console](../ui/agijobmanager.html) and [UI documentation](../ui/README.md) provide additional controls. Confirm that any console is configured for the deployment you intend to use; historical examples are not proof of a current live deployment.

Before signing, verify the network, manager address, and `usdcToken()`. USDC has six decimals and pays escrow/rewards/bonds; ETH pays gas. Approve exact amounts rather than unlimited spending. When using ENS, enter only a label, such as `alice`, rather than `alice.club.agi.eth`. Agents separately need an eligible NFT credential when the job’s recorded policy requires one. For free registration and payment outcomes, follow the [agent guide](../roles/AGENT.md).

A job is assigned by the first successful eligible application. Completion submission and validator votes do not automatically pay anyone: a finalization or dispute-resolution transaction must execute after the applicable conditions are satisfied.
