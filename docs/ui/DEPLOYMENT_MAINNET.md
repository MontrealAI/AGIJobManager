# USDC deployment registry

The [v1.19.6 transformation adapter](../successor/TRANSFORMATIONAL_WORK.md) is free inspection only for the current native zero-currency pilot. It creates no deployment, transaction or new intake authority. Existing deployment records and recovery inputs retain their original source identities.

## Software version

AGIJobManager v1.19.6. Status: **deployment-required**.

Software package; no transaction target is selected by default. The latest reported Manager deployment is recorded on 2026-10-17 in config/mainnet/manager-8815-2026-10-17.json; its authority snapshot reports paused intake. This owner-reported record is not live state or paid-intake qualification and does not establish an ENS helper attachment. The October 10 ENS-connected instance is historical and separate. Public-input work, no new review retainers, existing credits/claims and deployed contract behavior remain unchanged.

- Chain ID: 1
- Manager: Not recorded
- ENS job-page helper: Not recorded (optional)
- Final owner: Operator must supply and verify
- 30% recipient: Operator must supply and verify
- 10% recipient: Operator must supply and verify
- USDC: 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48
- Decimals: 6
- Address reference: https://developers.circle.com/stablecoins/usdc-contract-addresses

## Latest reported Manager deployment

Reported 2026-10-17: [0x3a9B3A0712e066de4265404Fa5ff4171fE29a3F8](https://etherscan.io/address/0x3a9B3A0712e066de4265404Fa5ff4171fE29a3F8#code) on Ethereum mainnet. All 9 creations were reported finalized. The explorer report records **6 Exact Match and 3 retained Similar Match**, not nine Exact Matches.

The owner-reported authority snapshot at block 26,214,525 reports intake paused. This is recorded evidence, not a live observation or paid-intake qualification. It does not establish an ENS helper attachment or select a transaction target. Review [all nine contracts and the remaining commissioning steps](../../docs/deployments/MAINNET_MANAGER_2026-10-17.md) and the [machine-readable record](../../config/mainnet/manager-8815-2026-10-17.json).

The [October 10 deployment and ENS helper](../deployments/MAINNET_USDC_2026-10-10.md) are a separate historical instance. Do not attach that helper to the latest Manager by inference.

## Constructor arguments

Follow the [Hardhat deployment guide](../../hardhat/README.md), [readiness guide](../MAINNET_READINESS.md) and [deployment runbook](../DEPLOY_RUNBOOK.md). Supply the two settlement wallets and explicit final governor through the reviewed constructor profile. All monetary arguments use six-decimal base units. Preserve original-asset jobs on their existing manager; legacy deployment snapshots are not USDC configurations. v1.19.6 includes explicit-governor constructor profiles and eight fixed library links. Use the exact selected source, constructor schema and compiler settings; do not substitute current constructor inputs into a historical deployment. The ENS membership correction introduced in v1.17.0 remains included, and NFT admission remains disabled by default. A verified v0.9.6 manager remains compatible with this console. v0.9.5 and older managers lack the getJobBonds getter and must keep their original interfaces for existing jobs. First deployments and moves from incompatible older versions require a fresh manager.

AGI Agents use agent.agi.eth or alpha.agent.agi.eth subnames; AGI Club validators use club.agi.eth or alpha.club.agi.eth. The contract preserves owner-managed allowlist and Merkle exceptions, and agents need a configured NFT eligibility credential only when their job requires it. Fresh v1.19.6 managers start with NFT admission disabled and an empty registry; owner changes affect future jobs only. Existing deployed settings remain unchanged. To opt in, register reviewed collections and enable the requirement before posting the affected jobs. Readiness requires READINESS_NFT_CONFIG with the chosen mode and complete collection registry. Optional job-page ENS wiring is separate from member identity. Review the four membership root nodes and any exceptions in the deployment plan.

## Verification

Compile with pinned solc 0.8.37 and the exact source-selected repository settings (via IR, optimizer 40 runs, Shanghai target and the reviewed no-L/E optimizer sequence). Preserve original compiler inputs and settings for historical verification; never replace them with the current profile. Verify the exact source and linked libraries, constructor arguments, chain ID, owner, USDC address and decimals before configuring any UI. Record the actual deployment receipt and update config/usdc-deployment.json only after verification. Blank defaults do not mean no instance was deployed. Start with the [latest reported Manager record](../../docs/deployments/MAINNET_MANAGER_2026-10-17.md) and [current inspection](../OPERATIONS/COMMISSIONING.md). The October 10 ENS-connected instance remains explicitly historical; activation requires separate review.
