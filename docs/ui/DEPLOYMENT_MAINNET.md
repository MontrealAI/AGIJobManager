# USDC deployment registry

## Official release

AGIJobManager v1.2.1. Status: **deployment-required**.

Software release only; no live USDC manager is recorded here. v1.2.1 strengthens read-only settlement reports with canonical block-hash reads, explicit token identity and RPC freshness checks, retaining the v1.0.5 privacy notices, public-content review and browser data handling. It preserves v1.0.3 contract behavior, ABI, bytecode, disabled NFT default and eight fixed library links. Existing jobs and agreements stay with their original deployment. Verify accepted ownership, both recipients, ENS wiring and READINESS_NFT_CONFIG before intake. Initial activation requires zero escrow, bonds and claims. Later recipient/NFT collection changes require zero live escrow and bonds; old claims retain their beneficiary. Complete the deployment-specific operator notice and applicable legal review; technical checks do not certify legal status.

- Chain ID: 1
- Manager: Not recorded
- ENS job-page helper: Not recorded (optional)
- Final owner: Operator must supply and verify
- 30% recipient: Operator must supply and verify
- 10% recipient: Operator must supply and verify
- USDC: 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48
- Decimals: 6
- Address reference: https://developers.circle.com/stablecoins/usdc-contract-addresses

## Constructor arguments

Follow the [Hardhat deployment guide](../../hardhat/README.md), [readiness guide](../MAINNET_READINESS.md) and [deployment runbook](../DEPLOY_RUNBOOK.md). Supply the two settlement wallets and accepted owner explicitly. All monetary arguments use six-decimal base units. Preserve original-asset jobs on their existing manager; legacy deployment snapshots are not USDC configurations. v1.2.1 retains the v0.9.6 ABI and deployed runtime bytecode, including eight fixed linked libraries; it retains the v1.0.3 constructor default with NFT admission disabled. A verified v0.9.6 manager remains compatible with this console. v0.9.5 and older managers lack the getJobBonds getter and must keep their original interfaces for existing jobs. First deployments and moves from incompatible older versions require a fresh manager.

AGI Agents use agent.agi.eth or alpha.agent.agi.eth subnames; AGI Club validators use club.agi.eth or alpha.club.agi.eth. The contract preserves owner-managed allowlist and Merkle exceptions, and agents need a configured NFT eligibility credential only when their job requires it. Fresh v1.2.1 managers start with NFT admission disabled and an empty registry; owner changes affect future jobs only. Existing deployed settings remain unchanged. To opt in, register reviewed collections and enable the requirement before posting the affected jobs. Readiness requires READINESS_NFT_CONFIG with the chosen mode and complete collection registry. Optional job-page ENS wiring is separate from member identity. Review the four membership root nodes and any exceptions in the deployment plan.

## Verification

Compile with pinned solc 0.8.37 and the repository settings in hardhat/hardhat.config.js (via IR, optimizer 40 runs, Shanghai target). Verify the exact source and linked libraries, constructor arguments, chain ID, owner, USDC address and decimals before configuring any UI. Record the actual deployment receipt and update config/usdc-deployment.json only after verification. This software release does not assert a live USDC deployment.
