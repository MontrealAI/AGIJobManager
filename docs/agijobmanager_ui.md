# AGIJobManager consoles — v0.9.2

Use the [primary v0.9.2 USDC console](../ui/agijobmanager-usdc.html) from the release/tag you intend to operate. The [secondary operator console](ui/agijobmanager.html) also supports role and owner workflows. Both require the intended deployment address and network; a released interface is not evidence that a new contract has been deployed.

## User workflows

Follow the [main user guide](USERS.md) and [end-to-end walkthrough](user-guide/happy-path.md). Jobs, rewards and bonds use native six-decimal USDC; Ethereum gas uses ETH. Agents require identity authorization plus an eligible NFT credential and the appropriate bond. Validator votes do not automatically pay a job: finalization must execute after the applicable timing/outcome conditions.

Disputed jobs use `resolveDisputeWithCode(jobId, code, reason)`: `0` leaves the dispute active, `1` settles for the agent, `2` refunds under employer-win rules. There is no current string-based `resolveDispute` call or built-in NFT marketplace.

## Owner and pending-owner controls

Current owners can use guarded operating controls; a proposed owner can use the ownership-acceptance flow. `transferOwnership` proposes a change, while `acceptOwnership` completes it. Check the connected wallet against `owner()` and `pendingOwner()`. See [owner controls](OWNER_CONTROLS.md) for pauses, recipient rotation, parameter restrictions and commissioning.

Verify addresses and transaction previews before signing. Simulations can identify current-state reverts but cannot guarantee the state remains unchanged before execution. Never enter a private key or recovery phrase into a console; the wallet signs transactions.

For public-network deployment use [Hardhat](../hardhat/README.md). Public-network Truffle signing is retired. For broader interface implementation and hosting information, see [UI documentation](ui/README.md). Historical interface instructions remain available in earlier Git tags.
