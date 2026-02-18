# Mainnet migration from legacy AGIJobManager snapshot

This workflow deploys `contracts/AGIJobManager.sol` using a deterministic, committed snapshot of the live legacy mainnet contract:

- Legacy: `0x0178B6baD606aaF908f72135B8eC32Fc1D5bA477`
- Snapshot script: `scripts/snapshotLegacyMainnetConfig.js`
- Snapshot output: `migrations/snapshots/legacy.mainnet.0x0178B6baD606aaF908f72135B8eC32Fc1D5bA477.json`
- Migration: `migrations/2_deploy_agijobmanager_from_legacy_snapshot.js`

## 1) Prerequisites

Required env vars:

- `MAINNET_RPC_URL` (read RPC)
- `ETHERSCAN_API_KEY` (ABI + tx reconstruction)
- `PRIVATE_KEYS` (for deployment)

Optional env vars:

- `CONFIRM_MAINNET_DEPLOY=1` (mandatory safety acknowledgement on chainId 1)
- `NEW_OWNER=0x...` (owner override; default keeps legacy owner)

## 2) Generate snapshot

```bash
MAINNET_RPC_URL=https://ethereum-rpc.publicnode.com \
ETHERSCAN_API_KEY=... \
node scripts/snapshotLegacyMainnetConfig.js --block 23200000
```

The snapshot includes:

- block metadata (`chainId`, `blockNumber`, `blockTimestamp`)
- ABI source hash (`snapshot.abiSourceHash`)
- constructor config (token, base IPFS URL, ENS/nameWrapper, root nodes, merkle roots)
- runtime flags and economic/timing parameters
- dynamic sets (`moderators`, additional allowlists, blacklists) with provenance tx hashes
- AGI type state reconstructed from `AGITypeUpdated` logs

If a required value cannot be recovered deterministically, the script throws and exits.

## 3) Review snapshot

```bash
cat migrations/snapshots/legacy.mainnet.0x0178B6baD606aaF908f72135B8eC32Fc1D5bA477.json
```

Operator review checklist:

- owner and token/ENS addresses
- pause flags and lock state
- thresholds, quorum, reward percentages, timing windows
- allowlists/blacklists and AGI type list

## 4) Deploy from committed snapshot

Recommended fork dry-run first:

```bash
MIGRATE_FROM_LEGACY_SNAPSHOT=1 \
truffle migrate --network development --f 2 --to 2
```

Mainnet:

```bash
MIGRATE_FROM_LEGACY_SNAPSHOT=1 \
CONFIRM_MAINNET_DEPLOY=1 \
MAINNET_RPC_URL=... \
PRIVATE_KEYS=... \
truffle migrate --network mainnet --f 2 --to 2
```

The migration does **not** call mainnet/Etherscan. It only reads the committed snapshot file.

## 5) Post-deploy verification checklist

Verify deployment logs include:

- all library addresses (`UriUtils`, `TransferUtils`, `BondMath`, `ReputationMath`, `ENSOwnership`)
- final `AGIJobManager` address
- `All assertions passed for mainnet legacy parity.`

Then compare read methods on the deployed contract to snapshot values:

- ownership and core addresses
- root nodes and merkle roots
- pause/settlement/lock states
- validator thresholds/quorum/economic params
- moderators, additional agents/validators, blacklists
- AGI types by index and payout

## 6) Etherscan verification with linked libraries

Use the repo verification process and provide constructor args + exact linked library addresses emitted by migration logs.
