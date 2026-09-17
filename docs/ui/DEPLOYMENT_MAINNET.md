# USDC deployment registry

## Official release

AGIJobManager v0.5.0. Status: **deployment-required**.

Software release only. No USDC manager has been deployed or verified by this release. Existing pre-v0.5.0 deployment receipts are historical and are not USDC deployments.

- Chain ID: 1
- Manager: Not deployed
- USDC: 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48
- Decimals: 6
- Address reference: https://developers.circle.com/stablecoins/usdc-contract-addresses

## Constructor arguments

Use the v0.5.0 Hardhat configuration and the immutable canonical USDC address. All monetary arguments use six decimal base units. A fresh deployment and explicit owner/identity configuration are required; legacy snapshots are incompatible.

## Verification

Compile with pinned solc 0.8.23 and the repository settings. Verify the new source and linked libraries, constructor arguments, chain ID, owner, USDC address and decimals before configuring any UI. Record the actual deployment receipt and update config/usdc-deployment.json only after verification. This software release does not assert a live USDC deployment.
