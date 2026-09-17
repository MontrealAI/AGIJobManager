# AGIJobManager interface — v0.9.5

The complete callable interface is maintained from source in [REFERENCE/CONTRACT_INTERFACE.md](REFERENCE/CONTRACT_INTERFACE.md); the ABI-generated [Interface.md](Interface.md) includes constructor fields, outputs, events and custom errors. Use these generated references rather than copied signatures from older releases.

## Settlement and configuration

- Native Circle USDC with six decimals is immutable at deployment.
- The sixth constructor argument is `address[2] settlementWallets`, in 30% then 10% order. `wallet30()` and `wallet10()` expose the current recipients. Their percentages are fixed; changing addresses requires paused intake and zero job escrow/agent/validator/dispute bond reserves.
- `createJob` fixes the validator budget for that job. `getJobCore(...).agentPayoutPct` is the base 60% minus that budget; NFT eligibility scores do not set payment shares. See [payout rules](USDC_PAYOUT_SPLIT.md).
- `agentNftRequired()` is the default for future postings; `setAgentNftRequired(bool)` is owner-only; `jobAgentNftRequired(jobId)` reads the immutable posting-time choice. NFT collection mutations require zero reserves. See [NFT policy](NFT_POLICY.md).
- `transferOwnership` proposes a handover; `pendingOwner` identifies the proposed recipient; only that recipient can call `acceptOwnership`. Renunciation is disabled.
- `resolveDisputeWithCode(jobId,code,reason)` uses 0 for no action, 1 for agent win and 2 for employer win. The old string-based dispute method and reward-pool contribution method are absent.

## Integration references

| Need | Reference |
| --- | --- |
| State machine, events and outcome accounting | [Protocol flow](PROTOCOL_FLOW.md) |
| Exact USDC units, budgets, bonds and rounding | [Payout specification](USDC_PAYOUT_SPLIT.md) |
| Owner update boundaries | [Owner controls](OWNER_CONTROLS.md), [configuration](CONFIGURATION.md) |
| ENS selectors and hook behavior | [Generated ENS reference](REFERENCE/ENS_REFERENCE.md) |
| Browser action review and signing | [Console guide](ui/GENESIS_JOB_MAINNET_HTML_UI.md) |
| Deployment and actual code verification | [Hardhat guide](../hardhat/README.md) |

No configured manager is supplied. A contract exposing expected getters is not authenticated merely by returning canonical USDC; verify the deployed code, linked libraries, owner and recipients before enabling writes.
