# Mainnet migration from legacy AGIJobManager

This runbook deploys `contracts/AGIJobManager.sol` using a deterministic snapshot of the live legacy mainnet contract state at `0x0178B6baD606aaF908f72135B8eC32Fc1D5bA477`.

## Prerequisites

- Node/npm dependencies installed (`npm ci`).
- Environment variables:
  - `MAINNET_RPC_URL` (archive-capable preferred; script defaults to `https://ethereum-rpc.publicnode.com` if unset)
  - `ETHERSCAN_API_KEY` (required for Etherscan API V2; script falls back to Blockscout metadata/tx APIs if unavailable)
  - `PRIVATE_KEYS` for deployment account.
  - `CONFIRM_MAINNET_DEPLOY=1` to intentionally allow mainnet deploy.
  - `USE_LEGACY_SNAPSHOT_MIGRATION=1` to run the snapshot-driven migration.
- Deployer account funded for library + contract deployment gas.

## 1) Generate a pinned snapshot (deterministic)

Example (pinning block):

```bash
MAINNET_RPC_URL=https://ethereum-rpc.publicnode.com \
ETHERSCAN_API_KEY=YOUR_KEY \
node scripts/snapshotLegacyMainnetConfig.js --block 22000000
```

Output file:

- `migrations/snapshots/legacy.mainnet.0x0178B6baD606aaF908f72135B8eC32Fc1D5bA477.json`

The script records:

- `chainId`, `blockNumber`, `blockTimestamp`
- proxy/implementation metadata
- constructor args (if retrievable)
- full config getters at pinned block
- replay-derived dynamic sets (moderators/additionals/blacklists/AGI types) with source tx provenance
- match/diff report versus the provided hints

## 2) Review snapshot before deploy

Verify at minimum:

- Core addresses (`owner`, `agiToken`, `ensRegistry`, `nameWrapper`, `ensJobPages`).
- Root nodes + Merkle roots.
- Economic/timing fields (validator thresholds, quorum, reward %, bond params, periods).
- Boolean control flags (`paused`, `settlementPaused`, `lockIdentityConfig`, `useEnsJobTokenURI`).
- Dynamic sets and counts:
  - moderators
  - additional agents/validators
  - blacklisted agents/validators
  - AGI type list (including disabled entries as payout 0 / `enabled:false`)

## 3) Run migration safely

Dry-run locally (Ganache test network) first:

```bash
USE_LEGACY_SNAPSHOT_MIGRATION=1 truffle migrate --network test --reset
```

Mainnet deploy:

```bash
USE_LEGACY_SNAPSHOT_MIGRATION=1 \
CONFIRM_MAINNET_DEPLOY=1 \
MAINNET_RPC_URL=https://eth-mainnet.g.alchemy.com/v2/YOUR_MAINNET_KEY \
PRIVATE_KEYS=0xYOUR_PRIVATE_KEY \
truffle migrate --network mainnet --reset
```

Optional owner override at migration end:

```bash
NEW_OWNER=0xYourChecksumSafeAddress
```

## 4) Post-deploy checks

The migration performs on-chain assertions and fails on mismatch. After successful deployment:

- Confirm AGIJobManager + library addresses printed in logs.
- Confirm `All assertions passed.` is printed.
- In Etherscan **Read Contract**, verify:
  - owner and identity/ENS fields
  - root nodes and merkle roots
  - risk/timing params
  - role mappings (`moderators`, `additionalAgents`, `additionalValidators`, blacklists)
  - `agiTypes(index)` entries align with snapshot order and payout values

## 5) Etherscan verification with linked libraries

Use repo tooling (`truffle-plugin-verify`) and ensure constructor args + linked library addresses exactly match deployment output. Typical flow:

```bash
ETHERSCAN_API_KEY=YOUR_KEY truffle run verify BondMath ENSOwnership ReputationMath TransferUtils UriUtils AGIJobManager --network mainnet
```

If verification fails, re-check:

- optimizer/viaIR settings from `truffle-config.js`
- constructor args from snapshot
- linked library addresses from deployment log
