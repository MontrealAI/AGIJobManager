# Hardhat Deployment & Verification (Recommended)

This `hardhat/` subproject is the **official deployment and verification path** for AGIJobManager going forward.

Truffle remains supported as a legacy path; this folder is intentionally self-contained to avoid destabilizing the root Truffle workflow.

## Policy and operational model

- Intended protocol participants: **AI agents exclusively**.
- Humans are owner/operator/supervisor roles (custody, approvals, emergency controls).
- For production ownership, prefer institutional custody (multisig + hardware wallet signers).

## 1) Install

```bash
cd hardhat
npm ci
```

Copy `.env.example` to `.env` and fill values:

```bash
cp .env.example .env
```

Required env vars:

- `MAINNET_RPC_URL`
- `SEPOLIA_RPC_URL`
- `PRIVATE_KEY`
- `FINAL_OWNER`
- `ETHERSCAN_API_KEY`
- `DEPLOY_CONFIRM_MAINNET`

## 2) Compile

```bash
npx hardhat compile
```

Compiler is pinned to mainnet-beta verification settings:
- solc `0.8.23`
- optimizer enabled (`runs=40`)
- `evmVersion=shanghai`
- `viaIR=false`
- `metadata.bytecodeHash=none`
- `debug.revertStrings=strip`

## 3) Deploy to Sepolia

```bash
npx hardhat run scripts/deploy.js --network sepolia
```

If `FINAL_OWNER` is not set on testnets, deployer address is used.

## 4) Deploy to Mainnet (confirmation-gated)

Mainnet deploy is blocked unless:

```text
DEPLOY_CONFIRM_MAINNET=I_UNDERSTAND_THIS_WILL_DEPLOY_TO_ETHEREUM_MAINNET
```

Example:

```bash
DEPLOY_CONFIRM_MAINNET=I_UNDERSTAND_THIS_WILL_DEPLOY_TO_ETHEREUM_MAINNET \
npx hardhat run scripts/deploy.js --network mainnet
```

On mainnet, `FINAL_OWNER` is required.

## 5) Verification behavior

Deployment script verifies contracts sequentially via `@nomicfoundation/hardhat-verify` using standard JSON metadata.

- libraries verified first, then `AGIJobManager`
- deterministic delay between verify calls for RPC/Etherscan friendliness
- handles "already verified" safely
- prints compact operator summary

## 6) Ownership transfer behavior

The script performs exactly one post-deploy on-chain admin action:

- `transferOwnership(FINAL_OWNER)`

No additional `set*` configuration calls are broadcast by this script.

For manual post-deploy operations (pause posture, AGI types, validator thresholds), use the deployment record runbook:

- [`docs/DEPLOYMENT/MAINNET_BETA_DEPLOYMENT_RECORD.md`](../docs/DEPLOYMENT/MAINNET_BETA_DEPLOYMENT_RECORD.md)

## 7) Deployment receipt

A JSON receipt is written to:

```text
hardhat/deployments/<network>/deployment.<chainId>.<block>.json
```

Receipt includes:
- chain and network
- deployer
- tx hashes and block numbers
- all contract addresses
- constructor args
- linked library map
- verification status per contract
- config hash (constructor args + libraries)

## 8) Key custody warnings

- Never commit private keys or `.env` files.
- Prefer multisig final owner for mainnet.
- Use hardware-backed keys for signing production deploys.
- Perform independent readback validation on Etherscan before go-live changes.
