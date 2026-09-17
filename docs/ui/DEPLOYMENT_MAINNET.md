# USDC deployment registry

## Official release

AGIJobManager v0.9.0. Status: **deployment-required**.

Software release only. Deploy a fresh v0.9.0 USDC manager with two explicit settlement wallets. Intake starts paused in the constructor. Complete deployment verification and two-step ownership acceptance before the owner opens intake. Recipient rotation requires paused intake and zero outstanding escrow and bonds.

- Chain ID: 1
- Manager: Not deployed
- USDC: 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48
- Decimals: 6
- Address reference: https://developers.circle.com/stablecoins/usdc-contract-addresses

## Constructor arguments

Use the v0.5.0 Hardhat configuration and the immutable canonical USDC address. All monetary arguments use six decimal base units. A fresh deployment and explicit owner/identity configuration are required; legacy snapshots are incompatible.

## Verification

Compile with pinned solc 0.8.23 and the repository settings. Verify the new source and linked libraries, constructor arguments, chain ID, owner, USDC address and decimals before configuring any UI. Record the actual deployment receipt and update config/usdc-deployment.json only after verification. This software release does not assert a live USDC deployment.
