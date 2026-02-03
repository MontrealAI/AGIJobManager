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
| `SOLC_VERSION` / `SOLC_RUNS` / `SOLC_VIA_IR` / `SOLC_EVM_VERSION` | Compiler settings | Defaults: `SOLC_VERSION=0.8.33`, `SOLC_RUNS=200`, `SOLC_VIA_IR=true`, `SOLC_EVM_VERSION=london`. |
| `GANACHE_MNEMONIC` | Local test mnemonic | Defaults to Ganache standard mnemonic if unset. |

A template lives in [`.env.example`](../.env.example).

> **Compiler note**: `AGIJobManager.sol` uses `pragma solidity ^0.8.33`, while the default Truffle compiler is `0.8.33`. For reproducible verification, keep `SOLC_VERSION`, optimizer runs, and the `viaIR` flag consistent with the original deployment.

## Runtime bytecode size (EIP-170)

Ethereum mainnet enforces the Spurious Dragon / EIP-170 limit of **24,576 bytes** for deployed runtime bytecode. To measure the runtime size locally after compiling:

```bash
node -e "const a=require('./build/contracts/AGIJobManager.json'); const b=(a.deployedBytecode||'').replace(/^0x/,''); console.log('AGIJobManager deployedBytecode bytes:', b.length/2)"
```

The mainnet-safe compiler settings used in `truffle-config.js` are:
- Optimizer enabled with **runs = 200**.
- `viaIR = true` by default to stay under the runtime bytecode size limit.
- `debug.revertStrings = 'strip'`.
- `metadata.bytecodeHash = 'none'`.

For a deterministic size gate that covers both `AGIJobManager` and `TestableAGIJobManager`, use:

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
- Keep the compiler settings (`SOLC_VERSION`, `SOLC_RUNS`, `SOLC_VIA_IR`, `SOLC_EVM_VERSION`) identical to the original deployment.
- Ensure your migration constructor parameters match the deployed contract.
- If the Etherscan plugin fails, re‑run with `--debug` to capture full output.

### Fallback: Standard JSON verification

If the plugin cannot verify, use Etherscan’s **Solidity (Standard-Json-Input)** flow:

1. Build a standard JSON input file (set `viaIR` to match your deployment):
   ```bash
   node -e "const fs=require('fs');const input={language:'Solidity',sources:{'contracts/AGIJobManager.sol':{content:fs.readFileSync('contracts/AGIJobManager.sol','utf8')}},settings:{optimizer:{enabled:true,runs:200},evmVersion:'london',viaIR:true,metadata:{bytecodeHash:'none'},outputSelection:{'*':{'*':['abi','evm.bytecode','evm.deployedBytecode','metadata']}}}};fs.writeFileSync('standard-json-input.json',JSON.stringify(input,null,2));"
   ```
2. Compile the JSON input with the exact compiler version:
   ```bash
   npx solc@0.8.33 --standard-json --base-path . --include-path node_modules standard-json-input.json > standard-json-output.json
   ```
3. In Etherscan, select **Solidity (Standard-Json-Input)** and paste the contents of `standard-json-input.json`.

**Inputs that must match deployment**: `solc` version, `optimizer.runs`, `viaIR`, `metadata.bytecodeHash`, and constructor arguments.

## Troubleshooting
- **Missing RPC URL**: set `SEPOLIA_RPC_URL` or `MAINNET_RPC_URL`, or provide `ALCHEMY_KEY` / `ALCHEMY_KEY_MAIN` / `INFURA_KEY`.
- **Missing private keys**: ensure `PRIVATE_KEYS` is set and comma‑separated.
- **Verification failures**: confirm compiler version, optimizer runs, and `viaIR` settings match the deployed bytecode.
- **Nonce conflicts**: avoid running multiple deployment processes with the same keys.
