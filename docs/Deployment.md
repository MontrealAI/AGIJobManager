# Deployment guide (Truffle)

This guide documents the deployment and verification workflow defined in `truffle-config.js` and the migration scripts in `migrations/`.
For the **configure-once, minimal-governance** deployment profile, see [`docs/DEPLOYMENT_PROFILE.md`](DEPLOYMENT_PROFILE.md).

## Prerequisites
- Node.js and npm (CI uses Node 20).
- Truffle (installed via `npm install`).
- RPC access for Sepolia or Mainnet (or a local Ganache instance).

## Environment variables

The configuration supports both direct RPC URLs and provider keys. `PRIVATE_KEYS` is required for Sepolia/Mainnet deployments.

| Variable | Purpose | Notes |
| --- | --- | --- |
| `PRIVATE_KEYS` | Deployer keys | Comma‑separated, no spaces. Required for Sepolia/Mainnet deployments. |
| `SEPOLIA_RPC_URL` | Sepolia RPC URL | Optional if using Alchemy or Infura. |
| `MAINNET_RPC_URL` | Mainnet RPC URL | Optional if using Alchemy or Infura. |
| `ALCHEMY_KEY` | Alchemy key for Sepolia | Used if `SEPOLIA_RPC_URL` is empty. |
| `ALCHEMY_KEY_MAIN` | Alchemy key for Mainnet | Falls back to `ALCHEMY_KEY` if empty. |
| `INFURA_KEY` | Infura key | Used if no direct RPC URL or Alchemy key. |
| `ETHERSCAN_API_KEY` | Verification key | Used by `truffle-plugin-verify`. |
| `SEPOLIA_GAS` / `MAINNET_GAS` | Gas limit override | Defaults to 8,000,000. |
| `SEPOLIA_GAS_PRICE_GWEI` / `MAINNET_GAS_PRICE_GWEI` | Gas price override | In Gwei. |
| `SEPOLIA_CONFIRMATIONS` / `MAINNET_CONFIRMATIONS` | Confirmations to wait | Defaults to 2. |
| `SEPOLIA_TIMEOUT_BLOCKS` / `MAINNET_TIMEOUT_BLOCKS` | Timeout blocks | Defaults to 500. |
| `RPC_POLLING_INTERVAL_MS` | Provider polling interval | Defaults to 8000 ms. |
| Compiler settings | Compiler settings | Pinned in `truffle-config.js` (solc `0.8.19`, runs `200`, `evmVersion` `london`). |
| `GANACHE_MNEMONIC` | Local test mnemonic | Defaults to Ganache standard mnemonic if unset. |

A template lives in [`.env.example`](../.env.example).

> **Compiler note**: `AGIJobManager.sol` uses `pragma solidity ^0.8.19`, while the Truffle compiler is pinned to `0.8.19` in `truffle-config.js`. For reproducible verification, keep the solc version and optimizer runs consistent with the original deployment.

## Runtime bytecode size (EIP-170)

Ethereum mainnet enforces the Spurious Dragon / EIP-170 limit of **24,576 bytes** for deployed runtime bytecode. To measure the runtime size locally after compiling:

```bash
node -e "const a=require('./build/contracts/AGIJobManager.json'); const b=(a.deployedBytecode||'').replace(/^0x/,''); console.log('AGIJobManager deployedBytecode bytes:', b.length/2)"
```

The mainnet-safe compiler settings used in `truffle-config.js` are:
- Optimizer enabled with **runs = 200**.
- `viaIR = false` by default.
- `debug.revertStrings = 'strip'`.
- `metadata.bytecodeHash = 'none'`.

For a deterministic size gate that covers `AGIJobManager`, use:

```bash
node scripts/check-bytecode-size.js
```

## Networks configured
- **test**: in‑process Ganache provider for `truffle test`.
- **development**: local RPC at `127.0.0.1:8545` (Ganache).
- **sepolia**: remote deployment via RPC (HDWalletProvider).
- **mainnet**: remote deployment via RPC (HDWalletProvider).

The default `npm test` script compiles with `--all`, runs `truffle test --network test`, and then executes an additional JavaScript test harness. Use the `test` network for deterministic local runs.

## Migration script notes

The deployment script in `migrations/2_deploy_contracts.js` reads constructor parameters from environment variables (token address, ENS registry, NameWrapper address, root nodes, Merkle roots). **Set these values** before deploying to any production network.
The constructor now accepts a grouped config tuple (token, base IPFS URL, `[ENS, NameWrapper]`, `[club, agent, alpha club, alpha agent]`, `[validator Merkle, agent Merkle]`), so custom deployments should mirror the migration script’s ordering.

## Local deployment (Ganache)

1. Start Ganache:
   ```bash
   npx ganache -p 8545
   ```
2. Deploy:
   ```bash
   npm run build
   npx truffle migrate --network development
   ```

## Sepolia deployment

1. Set environment variables (`PRIVATE_KEYS` plus RPC configuration).
2. Deploy:
   ```bash
   npm run build
   npx truffle migrate --network sepolia
   ```

## Mainnet deployment

1. Set environment variables (`PRIVATE_KEYS` plus RPC configuration).
2. Deploy:
   ```bash
   npm run build
   npx truffle migrate --network mainnet
   ```

## Verification (Etherscan)

When `ETHERSCAN_API_KEY` is set:

```bash
npx truffle run verify AGIJobManager --network sepolia
```

```bash
npx truffle run verify AGIJobManager --network mainnet
```

### Verification tips
- Keep the compiler settings from `truffle-config.js` identical to the original deployment (solc `0.8.19`, runs `200`, `evmVersion` `london`).
- Ensure your migration constructor parameters match the deployed contract.
- If the Etherscan plugin fails, re‑run with `--debug` to capture full output.
- Etherscan’s **Standard-Json-Input** flow should include `viaIR: false`, `optimizer.runs: 200`, and `metadata.bytecodeHash: "none"` if you verify manually.

## Troubleshooting
- **Missing RPC URL**: set `SEPOLIA_RPC_URL` or `MAINNET_RPC_URL`, or provide `ALCHEMY_KEY` / `ALCHEMY_KEY_MAIN` / `INFURA_KEY`.
- **Missing private keys**: ensure `PRIVATE_KEYS` is set and comma‑separated.
- **Verification failures**: confirm compiler version and optimizer runs match the deployed bytecode.
- **Nonce conflicts**: avoid running multiple deployment processes with the same keys.
