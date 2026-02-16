# Mainnet migration from legacy AGIJobManager

## Prerequisites

- `MAINNET_RPC_URL` (read-only RPC for snapshot, funded deploy RPC for migration)
- `ETHERSCAN_API_KEY` (required for Etherscan V2 API lookups)
- `PRIVATE_KEYS` for the deployer account
- `CONFIRM_MAINNET_DEPLOY=1` for mainnet execution

## 1) Generate a deterministic snapshot

Pin an explicit block:

```bash
MAINNET_RPC_URL=https://eth.llamarpc.com \
ETHERSCAN_API_KEY=... \
node scripts/snapshotLegacyMainnetConfig.js --block 24471342
```

Output file:

- `migrations/snapshots/legacy.mainnet.0x0178B6baD606aaF908f72135B8eC32Fc1D5bA477.json`

Review checklist:

- addresses (`owner`, `agiToken`, `ensRegistry`, `nameWrapper`)
- roots and merkle roots
- numeric risk params
- booleans (`paused`, `settlementPaused`, `lockIdentityConfig`, `useEnsJobTokenURI`)
- dynamic sets (`moderators`, `additional*`, blacklist sets)
- AGI type list and payout percentages

## 2) Dry-run on a fork (recommended)

If you have a local mainnet fork endpoint:

```bash
MAINNET_RPC_URL=http://127.0.0.1:8545 \
PRIVATE_KEYS=<deployer_pk> \
truffle migrate --network mainnet --f 2 --to 2
```

## 3) Mainnet migration

```bash
MAINNET_RPC_URL=https://<your-mainnet-rpc> \
PRIVATE_KEYS=<deployer_pk> \
CONFIRM_MAINNET_DEPLOY=1 \
truffle migrate --network mainnet --f 2 --to 2
```

Optional owner override:

```bash
NEW_OWNER=0x... truffle migrate --network mainnet --f 2 --to 2
```

## 4) Post-deploy verification checklist

In Etherscan **Read Contract** for the new deployment:

- constructor wiring: `agiToken`, `ens`, `nameWrapper`, roots, merkle roots
- thresholds and core params
- AGI types (`agiTypes(0..n)`)
- moderators/additionals/blacklists where applicable
- pause/settlement pause/identity lock flags
- final owner address

## 5) Etherscan verification with linked libraries

Use repo-native Truffle verification (`truffle-plugin-verify`) after deployment:

```bash
ETHERSCAN_API_KEY=... truffle run verify AGIJobManager --network mainnet
```

Ensure library addresses printed by migration match link references in the verified metadata.
