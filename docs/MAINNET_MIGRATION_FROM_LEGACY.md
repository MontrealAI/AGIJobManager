# MAINNET_MIGRATION_FROM_LEGACY

This guide deploys the new `contracts/AGIJobManager.sol` with configuration cloned from the live legacy mainnet contract:

- Legacy: `0x0178B6baD606aaF908f72135B8eC32Fc1D5bA477`
- Snapshot script: `scripts/snapshotLegacyConfig.mainnet.js`
- Committed snapshot: `migrations/legacy.snapshot.mainnet.0x0178B6baD606aaF908f72135B8eC32Fc1d5bA477.json`
- Migration: `migrations/2_deploy_agijobmanager_from_legacy_mainnet.js`

## Prerequisites

- `MAINNET_RPC_URL` (required)
- `ETHERSCAN_API_KEY` (required; ABI + tx replay)
- `PRIVATE_KEYS` (for deploy)
- Optional: `NEW_OWNER` (overrides snapshot owner transfer target)

## 1) Generate snapshot from live chain

```bash
MAINNET_RPC_URL=https://your-mainnet-rpc \
ETHERSCAN_API_KEY=yourKey \
node scripts/snapshotLegacyConfig.mainnet.js --block latest
```

The script performs:
- `eth_call` reads for all readable config
- deterministic tx replay for dynamic mappings (moderators/additional allowlists/blacklists)
- AGI type reconstruction from `AGITypeUpdated` logs
- failure on missing unrecoverable values (no guessing)

It writes:
- `migrations/legacy.snapshot.mainnet.0x0178B6baD606aaF908f72135B8eC32Fc1d5bA477.json`

Metadata includes chainId, block number, block timestamp, legacy address, ABI source details and ABI SHA-256.

## 2) Review snapshot

Check constructor/runtime/dynamic-set integrity before deploy:

```bash
cat migrations/legacy.snapshot.mainnet.0x0178B6baD606aaF908f72135B8eC32Fc1d5bA477.json
```

Review at least:
- constructor arguments (token, baseIpfsUrl, ENS config, roots, merkle roots)
- runtime flags/params
- moderators/additional agents/additional validators/blacklists
- AGI types ordering and payouts
- provenance tx hashes

## 3) Execute guarded migration

Dry-run (recommended):

```bash
MIGRATE_FROM_LEGACY_SNAPSHOT=1 \
truffle migrate --network development --f 2 --to 2
```

Mainnet:

```bash
MIGRATE_FROM_LEGACY_SNAPSHOT=1 \
CONFIRM_MAINNET_DEPLOY=1 \
MAINNET_RPC_URL=https://your-mainnet-rpc \
PRIVATE_KEYS=0x... \
truffle migrate --network mainnet --f 2 --to 2
```

Migration behavior:
- deploys + links `UriUtils`, `TransferUtils`, `BondMath`, `ReputationMath`, `ENSOwnership`
- deploys `AGIJobManager` with snapshot constructor config
- explicitly sets runtime/economic/timing params
- restores dynamic sets and AGI types
- re-applies pause/settlement/identity lock state
- transfers ownership at the end (defaults to legacy owner; optional `NEW_OWNER` override)
- performs post-deploy readback assertions and reverts on mismatch

## 4) Post-deploy verification checklist

From read contract, compare to snapshot:
- owner / agiToken / ENS addresses
- root nodes + merkle roots
- validator thresholds + timing params + bonds/slash
- paused + settlementPaused
- dynamic mapping membership checks
- AGI types by index

For private config (`baseIpfsUrl`, `useEnsJobTokenURI`) use migration logs and indirect behavior checks.

## 5) Etherscan verification with linked libraries

Follow repo process in `docs/VERIFY_ON_ETHERSCAN.md`, providing exact deployed library addresses and constructor args from the snapshot.
