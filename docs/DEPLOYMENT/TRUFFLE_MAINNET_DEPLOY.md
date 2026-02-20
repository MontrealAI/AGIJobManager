# AGIJobManager Mainnet Deployment (Truffle)

This guide covers production deployment using `migrations/3_deploy_agijobmanager_production.js`.

## Prerequisites

- Node.js + npm installed.
- Dependencies installed: `npm ci`.
- Truffle configured (`truffle-config.js`) with funded deployer key.
- RPC configured via one of:
  - `MAINNET_RPC_URL`, or
  - `ALCHEMY_KEY_MAIN` / `ALCHEMY_KEY`, or
  - `INFURA_KEY`.
- `PRIVATE_KEYS` set to deployer private key(s).

## 1) Prepare deployment config

1. Copy the template:

```bash
cp migrations/deploy.config.example.js migrations/deploy.config.mainnet.js
```

2. Edit `migrations/deploy.config.mainnet.js` and verify all values.

3. Optional env overrides are supported for key fields (addresses, roots, thresholds, lists, flags, ownership). The migration prints the fully resolved config before any deployment transaction.

## 2) Dry-run config review (no chain writes)

```bash
RUN_PRODUCTION_MIGRATION=1 DEPLOY_CONFIG_PATH=migrations/deploy.config.mainnet.js DEPLOY_CONFIRM_MAINNET=I_UNDERSTAND DEPLOY_DRY_RUN=1 npx truffle migrate --network mainnet --f 3 --to 3
```

## 3) Deploy to local/dev network

Create a dev profile first (the mainnet template only includes `mainnet` and `sepolia`):

```bash
cp migrations/deploy.config.example.js migrations/deploy.config.development.js
# edit migrations/deploy.config.development.js and add networks.development (or networks.1337)
```

Then run:

```bash
RUN_PRODUCTION_MIGRATION=1 DEPLOY_CONFIG_PATH=migrations/deploy.config.development.js npx truffle migrate --network development --f 3 --to 3
```

## 4) Deploy to Ethereum mainnet (guarded)

Mainnet is blocked by default. Explicitly acknowledge:

```bash
RUN_PRODUCTION_MIGRATION=1 DEPLOY_CONFIG_PATH=migrations/deploy.config.mainnet.js DEPLOY_CONFIRM_MAINNET=I_UNDERSTAND npx truffle migrate --network mainnet --f 3 --to 3
```

## 5) Outputs and artifacts

- Deployment logs include:
  - deployer address/balance,
  - resolved deployment config,
  - each library address + tx hash,
  - AGIJobManager address + tx hash,
  - post-deploy setter tx hashes.
- Receipt JSON written to:

```text
deployments/<network>/AGIJobManager.<timestamp>-<block>.json
```

Receipt includes chain metadata, config hash + expanded config, addresses, tx hashes, action log, and verification checks.

## 6) Post-deploy checklist

- Verify contract + libraries on Etherscan.
- Confirm owner (multisig if ownership transfer enabled).
- Confirm all expected getters match deployment receipt.
- Confirm role/address lists (moderators, allowlists, blacklists).
- Confirm pause + settlement states.
- If configured, confirm identity lock state.
- Archive receipt JSON in release artifacts.

## Notes

- `useEnsJobTokenURI` and `baseIpfsUrl` do not expose public getters, so migration reports this as a verification note.
- Keep `RUN_PRODUCTION_MIGRATION` and `DEPLOY_CONFIRM_MAINNET` unset in CI unless explicitly intended.
