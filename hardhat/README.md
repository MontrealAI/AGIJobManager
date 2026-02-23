# Hardhat Deployment & Verification (Official / Recommended)

This `hardhat/` subproject is the **official deployment path** for AGIJobManager.

- Truffle remains supported for legacy compatibility and existing migration workflows.
- This script is intentionally minimal and safe-by-default.
- Intended use is **AI agents exclusively**; humans are owners/operators/supervisors.

## What this script does

1. Deploys 5 libraries: `UriUtils`, `TransferUtils`, `BondMath`, `ReputationMath`, `ENSOwnership`.
2. Deploys `AGIJobManager` with constructor args.
3. Verifies all contracts on Etherscan using standard metadata (no flattening).
4. Optionally calls `transferOwnership(FINAL_OWNER)` if `FINAL_OWNER != deployer`.

## What this script does NOT do

- No `pause()`/`pauseAll()` calls.
- No `addAGIType(...)`.
- No Merkle root updates.
- No parameter tuning.
- No other post-deploy setup beyond optional ownership transfer.

## Quick start (Sepolia)

```bash
cd hardhat
npm ci
cp .env.example .env
# fill .env values
npm run compile
npm run deploy:sepolia
```

## Quick start (Mainnet) using Beta defaults

The script automatically uses `hardhat/deploy.config.example.js` if `DEPLOY_CONFIG` is not set.
That file is prefilled with the Mainnet Beta defaults.

```bash
cd hardhat
npm ci
cp .env.example .env
# fill .env values (including FINAL_OWNER)
npm run compile
DRY_RUN=1 npm run deploy:mainnet
DEPLOY_CONFIRM_MAINNET=I_UNDERSTAND_MAINNET_DEPLOYMENT npm run deploy:mainnet
```

## Required environment variables (plain language)

- `MAINNET_RPC_URL`: your Ethereum mainnet RPC endpoint.
- `SEPOLIA_RPC_URL`: your Sepolia RPC endpoint.
- `PRIVATE_KEY`: deployer private key (never commit this).
- `FINAL_OWNER`: final owner wallet (recommended multisig).
- `ETHERSCAN_API_KEY`: API key used for verification.

Optional controls:
- `CONFIRMATIONS` (default `3`)
- `VERIFY_DELAY_MS` (default `3500`)
- `DEPLOY_CONFIG` (path to custom config file)
- `DRY_RUN=1` (print plan and exit)

Mainnet confirmation gate:

```text
DEPLOY_CONFIRM_MAINNET=I_UNDERSTAND_MAINNET_DEPLOYMENT
```

## Mainnet Beta constructor defaults (automatically used)

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

## Artifacts for manual verification fallback

Each deployment writes:

- `hardhat/deployments/<network>/deployment.<chainId>.<blockNumber>.json`
- `hardhat/deployments/<network>/solc-input.json`
- `hardhat/deployments/<network>/verify-targets.json`

Use these for manual Etherscan **Standard JSON Input** verification if API/plugin verification is unavailable.

For institutional operational runbooks and mainnet beta state guidance, see:
- `docs/DEPLOYMENT/MAINNET_BETA_DEPLOYMENT_RECORD.md`
