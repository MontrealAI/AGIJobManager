# AGIJobManager Truffle Production Deployment

## Prerequisites
- `npm ci`
- RPC + signer env vars configured for `truffle-config.js` (`PRIVATE_KEYS`, `MAINNET_RPC_URL`/`SEPOLIA_RPC_URL` or Alchemy/Infura keys).
- Etherscan API key if you will verify immediately.

## 1) Configure deployment inputs (single file)
```bash
cp migrations/config/agijobmanager.config.example.js migrations/config/agijobmanager.config.js
```
Edit `migrations/config/agijobmanager.config.js` and verify every placeholder value before mainnet.

> Migration `5_deploy_agijobmanager_production_mainnet_final.js` is the canonical production migration. Migration `#4` is now legacy and skipped unless `AGIJOBMANAGER_ENABLE_LEGACY_MIGRATION_4=1`.

Optional: use a different path via `AGIJOBMANAGER_CONFIG_PATH=/abs/or/relative/path.js`.

## 2) Dry-run (validation + summary only)
```bash
AGIJOBMANAGER_DEPLOY=1 DEPLOY_DRY_RUN=1 npx truffle migrate --network sepolia --f 5 --to 5
```

## 3) Test deploy on local/sepolia
```bash
AGIJOBMANAGER_DEPLOY=1 npx truffle migrate --network development --f 5 --to 5
AGIJOBMANAGER_DEPLOY=1 npx truffle migrate --network sepolia --f 5 --to 5
```

## 4) Mainnet deploy (guarded)
Mainnet requires **both** env vars:
- `AGIJOBMANAGER_DEPLOY=1`
- `DEPLOY_CONFIRM_MAINNET=I_UNDERSTAND_THIS_WILL_DEPLOY_TO_ETHEREUM_MAINNET`

```bash
AGIJOBMANAGER_DEPLOY=1 DEPLOY_CONFIRM_MAINNET=I_UNDERSTAND_THIS_WILL_DEPLOY_TO_ETHEREUM_MAINNET npx truffle migrate --network mainnet --f 5 --to 5
```

## 5) Receipt output
A receipt is written to:
- `deployments/<network>/AGIJobManager.<chainId>.<blockNumber>.json`

## 6) Post-deploy checklist
- Confirm `owner()` equals intended final owner.
- Confirm root nodes and merkle roots match deployment config.
- Confirm pausable flags (`paused()`, `settlementPaused()`) are expected.
- Confirm key params (`voteQuorum`, reward %, bond params, durations).
- Verify contract/libraries on Etherscan.
- Record receipt file in release artifacts.
