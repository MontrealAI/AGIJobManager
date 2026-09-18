# USDC deployment registry

## Official release

AGIJobManager v0.9.6. Status: **deployment-required**.

Software release only; no live USDC manager is recorded here. v0.9.6 buyer-protection rules require a fresh manager and eight fixed linked libraries, including JobSettlement and JobValidation. Preserve every existing job on its original manager and namespace. Verify accepted ownership, both recipients, ENS wiring and READINESS_NFT_CONFIG before opening intake. Initial activation requires zero escrow, bonds and pending claims. Later recipient and NFT collection changes require zero live escrow and bonds; old claims retain their beneficiary.

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

Follow the [Hardhat deployment guide](../../hardhat/README.md), [readiness guide](../MAINNET_READINESS.md) and [deployment runbook](../DEPLOY_RUNBOOK.md). Supply the two settlement wallets and accepted owner explicitly. All monetary arguments use six-decimal base units. Preserve original-asset jobs on their existing manager; legacy deployment snapshots are not USDC configurations. The v0.9.6 buyer-protection interface changes manager bytecode and use eight fixed linked libraries, including JobSettlement and JobValidation. Exact job bond reads require the new getJobBonds getter and a fresh manager; preserve existing jobs on their original contracts.

AGI Agents use agent.agi.eth or alpha.agent.agi.eth subnames; AGI Club validators use club.agi.eth or alpha.club.agi.eth. The contract preserves owner-managed allowlist and Merkle exceptions, and agents need a configured NFT eligibility credential only when their job requires it. NFTs are required by default; owner changes affect future jobs only. Readiness requires READINESS_NFT_CONFIG with the chosen mode and complete collection registry. Optional job-page ENS wiring is separate from member identity. Review the four membership root nodes and any exceptions in the deployment plan.

## Verification

Compile with pinned solc 0.8.37 and the repository settings in hardhat/hardhat.config.js (via IR, optimizer 40 runs, Shanghai target). Verify the exact source and linked libraries, constructor arguments, chain ID, owner, USDC address and decimals before configuring any UI. Record the actual deployment receipt and update config/usdc-deployment.json only after verification. This software release does not assert a live USDC deployment.
