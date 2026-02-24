# Mainnet Deployment Artifacts

This folder stores the official Ethereum Mainnet deployment record for AGIJobManager.

## Files

- `deployment.1.24522684.json`
  - Deployment receipt record.
  - Includes chain/network, deployer/final owner, contract addresses, deployment transaction hashes, constructor arguments, linked library addresses, and ownership transfer transaction.
- `solc-input.json`
  - Solidity Standard JSON Input used for compilation/verification.
  - Use this file in Etherscan's manual "Standard JSON Input" verification flow.
- `verify-targets.json`
  - Verification target index.
  - Maps each contract name and fully-qualified name (FQN) to the deployed mainnet address.

## Manual verification usage (Etherscan)

1. Open the target contract page on Etherscan.
2. Go to `Contract` -> `Verify and Publish`.
3. Select Standard JSON Input mode.
4. Paste/upload `solc-input.json`.
5. For AGIJobManager, provide linked library addresses from `deployment.1.24522684.json` (or `verify-targets.json`).
6. Confirm constructor arguments match `deployment.1.24522684.json`.

Use repository-relative paths only when documenting or sharing this record.
