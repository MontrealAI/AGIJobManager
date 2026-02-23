# Mainnet Deployment Artifact Record

This folder stores durable, repository-relative artifacts for the official Ethereum Mainnet deployment.

## Files

- `deployment.1.24522684.json`
  - Canonical deployment receipt.
  - Includes network, deployer, final owner, contract addresses, tx hashes, compiler settings, constructor args, and ownership transfer tx.

- `solc-input.json`
  - Canonical compiler configuration record for Etherscan Standard JSON Input workflows.
  - Portable metadata only. No local absolute paths.

- `verify-targets.json`
  - Verification target list with fully qualified names, deployed addresses, constructor args, and linked library mapping.

## Why this folder matters

These files preserve the data needed to re-verify and re-audit the deployment years later without relying on local machine state.
