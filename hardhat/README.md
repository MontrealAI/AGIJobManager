# Hardhat Deployment & Verification (Official / Recommended)

This `hardhat/` subproject is the official deployment and verification workflow for AGIJobManager.

- **Truffle remains supported (legacy path) and is intentionally left intact.**
- **Protocol intent:** AI agents execute protocol workflows; humans are owners/operators/supervisors.
- This deploy flow does only:
  1) deploy 5 libraries,
  2) deploy `AGIJobManager` with constructor args,
  3) verify on Etherscan (standard-json metadata path; no flattening),
  4) `transferOwnership(finalOwner)` if needed.

It does **not** run post-deploy tuning (no pause calls, no AGI type changes, no parameter setters, no root updates).

## Beta default constructor profile (mainnet)

These defaults are baked into `deploy.config.example.js` and used automatically unless overridden via `DEPLOY_CONFIG`.

```text
agiTokenAddress: 0xa61a3b3a130a9c20768eebf97e21515a6046a1fa
baseIpfsUrl:     https://ipfs.io/ipfs/
ensConfig:
  [0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e, 0xD4416b13d2b3a9aBae7AcD5D6C2BbDBE25686401]
rootNodes:
  0x39eb848f88bdfb0a6371096249dd451f56859dfe2cd3ddeab1e26d5bb68ede16
  0x2c9c6189b2e92da4d0407e9deb38ff6870729ad063af7e8576cb7b7898c88e2d
  0x6487f659ec6f3fbd424b18b685728450d2559e4d68768393f9c689b2b6e5405e
  0xc74b6c5e8a0d97ed1fe28755da7d06a84593b4de92f6582327bc40f41d6c2d5e
merkleRoots:
  0x0effa6c54d4c4866ca6e9f4fc7426ba49e70e8f6303952e04c8f0218da68b99b
  0x0effa6c54d4c4866ca6e9f4fc7426ba49e70e8f6303952e04c8f0218da68b99b
```

Context token for this repo release: `AGIALPHA` ERC-20 is `0xA61a3B3a130a9c20768EEBF97E21515A6046a1Fa`.

## Required environment variables (plain language)

Copy and fill `.env`:

```bash
cd hardhat && npm ci
cp .env.example .env
```

- `MAINNET_RPC_URL`: your Ethereum mainnet RPC endpoint.
- `SEPOLIA_RPC_URL`: your Ethereum sepolia RPC endpoint.
- `PRIVATE_KEY`: deployer EOA private key (never commit `.env`).
- `ETHERSCAN_API_KEY`: Etherscan API key used by verification plugin.
- `FINAL_OWNER`: owner after deploy (recommended: multisig).
- `DEPLOY_CONFIRM_MAINNET`: required mainnet safety phrase.
- `CONFIRMATIONS`: waits after each tx (default `3`).
- `VERIFY_DELAY_MS`: delay between verification calls (default `3500`).
- `DRY_RUN`: set `1` to print plan and exit.
- `DEPLOY_CONFIG`: optional path to a custom config JS file.

Mainnet safety phrase:

```text
I_UNDERSTAND_MAINNET_DEPLOYMENT
```

## Quick start (Sepolia)

Create a local Sepolia config first (the template contains placeholders by design):

```bash
cd hardhat && npm ci
cp .env.example .env
cp deploy.config.example.js deploy.config.local.js
# Edit deploy.config.local.js -> sepolia profile with real agiTokenAddress, ENS addresses, roots, and optional finalOwner
npx hardhat compile
DEPLOY_CONFIG=deploy.config.local.js npm run deploy:sepolia
```

## Quick start (Mainnet) using Beta defaults

Use defaults directly from `deploy.config.example.js` (no extra config file required).

Dry-run plan only:

```bash
cd hardhat
DRY_RUN=1 npm run deploy:mainnet
```

Execute mainnet deployment:

```bash
cd hardhat
DEPLOY_CONFIRM_MAINNET=I_UNDERSTAND_MAINNET_DEPLOYMENT FINAL_OWNER=0xYourFinalOwnerAddress npm run deploy:mainnet
```

## Artifacts for operations + manual verification fallback

Each deployment writes:

- `hardhat/deployments/<network>/deployment.<chainId>.<blockNumber>.json`
- `hardhat/deployments/<network>/solc-input.json`
- `hardhat/deployments/<network>/verify-targets.json`

Use these for manual Etherscan **Standard JSON Input** verification if API/plugin automation is unavailable.

For manual post-deploy operating steps through Etherscan, follow:

- [`docs/DEPLOYMENT/MAINNET_BETA_DEPLOYMENT_RECORD.md`](../docs/DEPLOYMENT/MAINNET_BETA_DEPLOYMENT_RECORD.md)
