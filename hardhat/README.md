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
ensConfig (address[2]):
  [0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e, 0xD4416b13d2b3a9aBae7AcD5D6C2BbDBE25686401]
rootNodes (bytes32[4]):
  0x39eb848f88bdfb0a6371096249dd451f56859dfe2cd3ddeab1e26d5bb68ede16
  0x2c9c6189b2e92da4d0407e9deb38ff6870729ad063af7e8576cb7b7898c88e2d
  0x6487f659ec6f3fbd424b18b685728450d2559e4d68768393f9c689b2b6e5405e
  0xc74b6c5e8a0d97ed1fe28755da7d06a84593b4de92f6582327bc40f41d6c2d5e
merkleRoots (bytes32[2]):
  0x0effa6c54d4c4866ca6e9f4fc7426ba49e70e8f6303952e04c8f0218da68b99b
  0x0effa6c54d4c4866ca6e9f4fc7426ba49e70e8f6303952e04c8f0218da68b99b
```

## Default final owner (mainnet profile + env template)

- `FINAL_OWNER=0xa9eD0539c2fbc5C6BC15a2E168bd9BCd07c01201` (`club.agi.eth`)
- Resolution order is:
  1. `FINAL_OWNER` env (if set)
  2. `finalOwner` in deploy profile
- If you do nothing, the deployment defaults to `0xa9eD0539c2fbc5C6BC15a2E168bd9BCd07c01201`.

Context token for this repo release: AGIALPHA ERC-20 is `0xA61a3B3a130a9c20768EEBF97E21515A6046a1Fa`.

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
- `FINAL_OWNER`: optional override; default is already prefilled to club.agi.eth owner address.
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

## Quick start (Mainnet) using Beta defaults + default FINAL_OWNER (club.agi.eth)

Copy/paste command flow:

```bash
cd hardhat && npm ci
cp .env.example .env
# Edit .env: set MAINNET_RPC_URL, PRIVATE_KEY, ETHERSCAN_API_KEY
# On mainnet, include the confirmation gate even for dry-run plan output
DRY_RUN=1 DEPLOY_CONFIRM_MAINNET=I_UNDERSTAND_MAINNET_DEPLOYMENT npm run deploy:mainnet
DEPLOY_CONFIRM_MAINNET=I_UNDERSTAND_MAINNET_DEPLOYMENT npm run deploy:mainnet
```

Optional override if you need a different owner than the default:

```bash
FINAL_OWNER=0xYourOverrideOwner DEPLOY_CONFIRM_MAINNET=I_UNDERSTAND_MAINNET_DEPLOYMENT npm run deploy:mainnet
```


## ENSJobPages deployment utility (additive)

This repo also includes an additive utility script to deploy or replace `ENSJobPages` without changing the official AGIJobManager deployment flow above.

```bash
cd hardhat
npm ci
cp .env.example .env
# edit .env to set MAINNET_RPC_URL, PRIVATE_KEY, ETHERSCAN_API_KEY, DEPLOY_CONFIRM_MAINNET

npx hardhat compile

DRY_RUN=1 DEPLOY_CONFIRM_MAINNET=I_UNDERSTAND_MAINNET_DEPLOYMENT \
npx hardhat run scripts/deploy-ens-job-pages.js --network mainnet

DEPLOY_CONFIRM_MAINNET=I_UNDERSTAND_MAINNET_DEPLOYMENT \
VERIFY=1 \
NEW_OWNER=0xa9eD0539c2fbc5C6BC15a2E168bd9BCd07c01201 \
npx hardhat run scripts/deploy-ens-job-pages.js --network mainnet
```

Manual post-deploy steps:
1) `setApprovalForAll(newEnsJobPages, true)` on `NameWrapper` by the wrapped-root owner.
2) `setEnsJobPages(newEnsJobPages)` on `AGIJobManager` by the `AGIJobManager` owner.

## Artifacts for operations + manual verification fallback

Each deployment writes:

- `hardhat/deployments/<network>/deployment.<chainId>.<blockNumber>.json`
- `hardhat/deployments/<network>/solc-input.json`
- `hardhat/deployments/<network>/verify-targets.json`

Use these for manual Etherscan **Standard JSON Input** verification if API/plugin automation is unavailable.

For manual post-deploy operating steps through Etherscan, follow:

- [`docs/DEPLOYMENT/MAINNET_BETA_DEPLOYMENT_RECORD.md`](../docs/DEPLOYMENT/MAINNET_BETA_DEPLOYMENT_RECORD.md)
