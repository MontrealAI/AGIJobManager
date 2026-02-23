# Hardhat Deployment & Verification (Official / Recommended)

This `hardhat/` subproject is the official deployment path for AGIJobManager.

- **AI agents are the intended protocol participants.** Humans are owners/operators/supervisors.
- Truffle remains available and supported for legacy reproducibility.
- This workflow performs only: deploy 5 libraries, deploy `AGIJobManager`, verify contracts, transfer ownership.
- This workflow does **not** perform parameter tuning, pause toggles, AGI type updates, Merkle root updates, or other setter bursts.

## Quick start (Sepolia)

```bash
cd hardhat
npm ci
cp .env.example .env
# fill .env with SEPOLIA_RPC_URL, PRIVATE_KEY, ETHERSCAN_API_KEY
DRY_RUN=1 npm run deploy:sepolia
npm run deploy:sepolia
```

## Quick start (Mainnet) using Beta defaults

Default constructor profile is loaded from `hardhat/deploy.config.example.js` when `DEPLOY_CONFIG` is not set.

```bash
cd hardhat
npm ci
cp .env.example .env
# fill .env with MAINNET_RPC_URL, PRIVATE_KEY, ETHERSCAN_API_KEY, FINAL_OWNER (recommended multisig)
DRY_RUN=1 npm run deploy:mainnet
DEPLOY_CONFIRM_MAINNET=I_UNDERSTAND_MAINNET_DEPLOYMENT npm run deploy:mainnet
```

## Required environment variables (plain language)

- `MAINNET_RPC_URL` / `SEPOLIA_RPC_URL`: your JSON-RPC provider endpoint.
- `PRIVATE_KEY`: funded deployer key used to broadcast transactions.
- `ETHERSCAN_API_KEY`: key for contract verification.
- `FINAL_OWNER`: post-deploy owner (recommended: multisig).

Optional:
- `DEPLOY_CONFIG`: custom config file path; default is `deploy.config.example.js`.
- `DRY_RUN=1`: print plan and exit without transactions.
- `CONFIRMATIONS`: confirmations to wait after each tx (default `3`).
- `VERIFY_DELAY_MS`: delay between verification requests (default `4000`).

## Mainnet Beta default constructor args (verbatim)

These are the exact defaults used by the built-in mainnet profile:

- `agiTokenAddress`: `0xa61a3b3a130a9c20768eebf97e21515a6046a1fa`
- `baseIpfsUrl`: `https://ipfs.io/ipfs/`
- `ensConfig`:
  - `0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e`
  - `0xD4416b13d2b3a9aBae7AcD5D6C2BbDBE25686401`
- `rootNodes`:
  - `0x39eb848f88bdfb0a6371096249dd451f56859dfe2cd3ddeab1e26d5bb68ede16`
  - `0x2c9c6189b2e92da4d0407e9deb38ff6870729ad063af7e8576cb7b7898c88e2d`
  - `0x6487f659ec6f3fbd424b18b685728450d2559e4d68768393f9c689b2b6e5405e`
  - `0xc74b6c5e8a0d97ed1fe28755da7d06a84593b4de92f6582327bc40f41d6c2d5e`
- `merkleRoots`:
  - `0x0effa6c54d4c4866ca6e9f4fc7426ba49e70e8f6303952e04c8f0218da68b99b`
  - `0x0effa6c54d4c4866ca6e9f4fc7426ba49e70e8f6303952e04c8f0218da68b99b`

Contextual token reference for this repo version: AGIALPHA ERC-20 `0xA61a3B3a130a9c20768EEBF97E21515A6046a1Fa`.

## Output artifacts and manual verification fallback

Each run writes:

- `hardhat/deployments/<network>/deployment.<chainId>.<blockNumber>.json`
- `hardhat/deployments/<network>/solc-input.json`
- `hardhat/deployments/<network>/verify-targets.json`

Use `solc-input.json` + `verify-targets.json` for manual Etherscan Standard JSON Input verification if API/plugin verification is unavailable.

For manual beta operational actions via Etherscan, see:
- `docs/DEPLOYMENT/MAINNET_BETA_DEPLOYMENT_RECORD.md`
