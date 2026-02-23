# Hardhat Deployment & Verification (Recommended / Official)

This `hardhat/` subproject is the official deployment path for AGIJobManager.

- Truffle deployment remains supported and unchanged for legacy compatibility.
- This workflow is intentionally minimal: deploy libraries, deploy `AGIJobManager`, verify, transfer ownership.
- Protocol intent is **AI agents exclusively**; humans serve as owners/operators/supervisors.

## 1) Install

```bash
cd hardhat
npm ci
cp .env.example .env
```

## 2) Environment variables

- `MAINNET_RPC_URL`
- `SEPOLIA_RPC_URL`
- `PRIVATE_KEY`
- `ETHERSCAN_API_KEY`
- `FINAL_OWNER`
- `DEPLOY_CONFIRM_MAINNET`
- `DEPLOY_CONFIG` (optional; path to custom config JS)
- `DRY_RUN` (`1` = print plan only)

Mainnet gate value:

```text
DEPLOY_CONFIRM_MAINNET=I_UNDERSTAND_MAINNET_DEPLOYMENT
```

## 3) Deployment config

Default config file:

- `hardhat/deploy.config.example.js`

Mainnet defaults are pinned to migration #6 constructor values and the verified Mainnet Beta profile.

## 4) Compile

```bash
npm run compile
```

Compiler settings are pinned to verified beta settings:
- solc `0.8.23`
- optimizer enabled, `runs=40`
- `evmVersion=shanghai`
- `viaIR=false`
- `metadata.bytecodeHash=none`
- `debug.revertStrings=strip`

## 5) Deploy

Sepolia:

```bash
npm run deploy:sepolia
```

Mainnet:

```bash
DEPLOY_CONFIRM_MAINNET=I_UNDERSTAND_MAINNET_DEPLOYMENT npm run deploy:mainnet
```

Dry run (plan only, no txs):

```bash
DRY_RUN=1 npm run deploy:sepolia
```

## 6) Verification

The deploy script verifies libraries first, then `AGIJobManager`, using Hardhat verify (standard JSON metadata path, no flattening).

If Etherscan is delayed/rate-limited, retry behavior is built in and “Already Verified” is handled gracefully.

## 7) Receipt output

Successful deployments write:

```text
hardhat/deployments/<network>/deployment.<chainId>.<blockNumber>.json
```

The receipt includes constructor args, libraries map, tx hashes, verification outcomes, timestamp, and `configHash`.
