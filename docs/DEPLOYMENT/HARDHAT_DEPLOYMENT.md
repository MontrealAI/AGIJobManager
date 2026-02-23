# Deployment (recommended): Hardhat

> **Intended use:** AGIJobManager is designed for autonomous AI agents. Humans act as owners/operators/supervisors.

This repository now provides an official, operator-friendly Hardhat path under [`hardhat/`](../../hardhat) for:

1. deploying the required libraries,
2. deploying `AGIJobManager` with constructor args,
3. verifying all contracts on Etherscan using standard JSON,
4. transferring ownership to the final owner.

Truffle deployments remain fully supported for legacy workflows, but Hardhat is the recommended path.

## 1) Setup

```bash
cd hardhat
cp .env.example .env
# Optionally copy deploy.config.example.js to deploy.config.js and edit safely.
npm ci
npx hardhat compile
```

## 2) Required environment variables

- `MAINNET_RPC_URL`
- `SEPOLIA_RPC_URL`
- `PRIVATE_KEY`
- `ETHERSCAN_API_KEY`
- `FINAL_OWNER` (required on mainnet)
- `DEPLOY_CONFIRM_MAINNET` (must equal `I_UNDERSTAND_MAINNET_DEPLOYMENT` on mainnet)
- `DEPLOY_CONFIG` (optional path override, defaults to `deploy.config.example.js`)
- `DRY_RUN=1` to print plan only

## 3) Safe deployment flow

### Dry run (no chain writes)

```bash
cd hardhat
DRY_RUN=1 npx hardhat run scripts/deploy.js --network sepolia
```

### Sepolia deployment

```bash
cd hardhat
npx hardhat run scripts/deploy.js --network sepolia
```

### Mainnet deployment (guarded)

```bash
cd hardhat
FINAL_OWNER=0xYourFinalOwner DEPLOY_CONFIRM_MAINNET=I_UNDERSTAND_MAINNET_DEPLOYMENT npx hardhat run scripts/deploy.js --network mainnet
```

The script prints a deployment plan before broadcasting, validates addresses/bytes32 inputs, verifies contracts on Etherscan, and writes a JSON receipt into:

- `hardhat/deployments/<network>/deployment.<chainId>.<blockNumber>.json`

## 4) Mainnet beta profile defaults

The default `mainnet` profile in `hardhat/deploy.config.example.js` mirrors migration #6 constructor values and the verified mainnet beta deployment profile.

Before any production deploy, operators must re-verify all values with owner approval.
