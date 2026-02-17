# Mainnet migration from legacy AGIJobManager snapshot

This runbook deploys `contracts/AGIJobManager.sol` using a deterministic snapshot of the live legacy contract on mainnet:

- Legacy address: `0x0178B6baD606aaF908f72135B8eC32Fc1D5bA477`
- Snapshot output: `migrations/snapshots/legacy.mainnet.0x0178B6baD606aaF908f72135B8eC32Fc1D5bA477.json`
- Migration: `migrations/2_deploy_agijobmanager_from_legacy_snapshot.js`

## Prerequisites

- `MAINNET_RPC_URL` (read RPC for snapshot + deploy RPC for migration)
- `ETHERSCAN_API_KEY` (preferred for ABI + tx list extraction)
- `PRIVATE_KEYS` (funded deployer private key for Truffle deployment)
- `CONFIRM_MAINNET_DEPLOY=1` (required safety override only on chainId 1)
- Optional: `NEW_OWNER` (override transferOwnership target)
- Optional: `ALLOW_DEFAULT_CHALLENGE_PERIOD=1` (only if snapshot has `challengePeriodAfterApproval = "0"` placeholder and you explicitly accept contract default non-zero value)

## 1) Generate a deterministic snapshot (pin block)

Example (pinned):

```bash
MAINNET_RPC_URL=https://ethereum-rpc.publicnode.com \
ETHERSCAN_API_KEY=... \
node scripts/snapshotLegacyMainnetConfig.js --block 23200000
```

Notes:
- The script uses `eth_call` at the specified block tag.
- If `ETHERSCAN_API_KEY` is missing, it falls back to Etherscan HTML scraping for ABI/tx discovery.
- The script records `chainId`, `blockNumber`, and `blockTimestamp`.

## 2) Review snapshot JSON before deploy

Inspect and verify:

- Constructor config:
  - `constructorConfig.agiTokenAddress`
  - `constructorConfig.baseIpfsUrl`
  - `constructorConfig.ensConfig`
  - `constructorConfig.rootNodes`
  - `constructorConfig.merkleRoots`
- Runtime config:
  - owner/pause booleans
  - validator/economic/timing params
- Dynamic sets:
  - moderators/additionals/blacklists and provenance
- AGI types:
  - ordered list with payout percentages and enabled flags

Recommended manual check:

```bash
cat migrations/snapshots/legacy.mainnet.0x0178B6baD606aaF908f72135B8eC32Fc1D5bA477.json
```

## 3) Dry-run on fork (recommended)

Start fork (example Anvil):

```bash
anvil --fork-url "$MAINNET_RPC_URL" --fork-block-number 23200000
```

Run migration against local fork:

```bash
MIGRATE_FROM_LEGACY_SNAPSHOT=1 \
truffle migrate --network development --f 2 --to 2
```

## 4) Mainnet migration (guarded)

```bash
MIGRATE_FROM_LEGACY_SNAPSHOT=1 \
CONFIRM_MAINNET_DEPLOY=1 \
MAINNET_RPC_URL=... \
PRIVATE_KEYS=... \
truffle migrate --network mainnet --f 2 --to 2
```

Optional ownership override:

```bash
NEW_OWNER=0xYourSafeAddress ... truffle migrate --network mainnet --f 2 --to 2
```

Safety behavior:
- Migration aborts on chainId mismatch vs snapshot (except local fork IDs 1337/31337).
- Migration aborts on mainnet unless `CONFIRM_MAINNET_DEPLOY=1`.
- Migration performs post-deploy on-chain assertions and fails on mismatch.

## 5) Post-deploy verification checklist (Etherscan Read Contract)

Verify the deployed AGIJobManager:

- core addresses (`agiToken`, `ens`, `nameWrapper`, `owner`)
- root nodes + merkle roots
- validator/timing/economic parameters
- pause/settlement flags
- moderators/additional/blacklisted addresses
- AGI types array values by index

Migration output prints deployed library addresses and manager address.

## 6) Etherscan verification with linked libraries

Use existing repository verification flow and include linked library addresses from migration logs.

Typical steps:

1. Compile with repo solc settings (`npm run build`).
2. Use repo verification tooling (`docs/VERIFY_ON_ETHERSCAN.md`) and provide library addresses exactly as deployed.
3. Verify AGIJobManager constructor args from snapshot JSON.
