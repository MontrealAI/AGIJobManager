# Mainnet migration from legacy AGIJobManager

This runbook migrates configuration from the live legacy contract (`0x0178B6baD606aaF908f72135B8eC32Fc1D5bA477`) into a fresh deployment of `contracts/AGIJobManager.sol` using a deterministic, committed snapshot.

## Prerequisites

- Node/Truffle toolchain from this repo (`npm ci`).
- Env vars:
  - `MAINNET_RPC_URL` (Ethereum mainnet RPC, read for snapshot and write for deploy)
  - `ETHERSCAN_API_KEY` (required by script for Etherscan ABI/source and txlist; if unavailable script falls back to Blockscout and records this)
  - `PRIVATE_KEYS` (funded deployer key for `truffle migrate`)
  - `CONFIRM_MAINNET_DEPLOY=1` (required guardrail for chainId 1)
  - Optional: `NEW_OWNER=0x...` to override owner handoff destination.

## 1) Generate deterministic snapshot (pinned block)

```bash
MAINNET_RPC_URL="https://..." \
ETHERSCAN_API_KEY="..." \
node scripts/snapshotLegacyMainnetConfig.js --block 23050000
```

Output file:

- `migrations/snapshots/legacy.mainnet.0x0178B6baD606aaF908f72135B8eC32Fc1D5bA477.json`

Snapshot includes:

- `chainId`, `blockNumber`, `blockTimestamp`, proxy metadata.
- Constructor inputs (token/baseIPFS/ENS/rootNodes/merkle roots).
- Adjustable params (thresholds, quorum, bond/reward/timing params when available).
- Paused/settlement/identity-lock booleans.
- Reconstructed dynamic sets (moderators/additional agents/additional validators/blacklists) with tx provenance.
- AGI type ordering and update provenance from `AGITypeUpdated` logs.

## 2) Review snapshot before deploy

Check:

- Addresses are checksummed and expected for the selected block.
- Dynamic-set entries are complete and `enabled=true` entries look correct.
- AGI types include intended enabled/disabled payout state.
- Hint comparison output in script logs is understood (matches/diffs are expected to be explicit).

## 3) Run migration safely

Mainnet (guarded):

```bash
MAINNET_RPC_URL="https://..." \
PRIVATE_KEYS="0x..." \
CONFIRM_MAINNET_DEPLOY=1 \
truffle migrate --network mainnet --f 2 --to 2
```

Optional owner override:

```bash
NEW_OWNER="0x..." truffle migrate --network mainnet --f 2 --to 2
```

Migration behavior:

- No runtime Etherscan/RPC lookups for snapshot data; only committed JSON is used.
- Deploys and links `BondMath`, `ENSOwnership`, `ReputationMath`, `TransferUtils`, `UriUtils`.
- Deploys `AGIJobManager` with snapshot constructor arguments.
- Restores config and dynamic sets in deterministic order.
- Restores paused/settlement/identity lock booleans.
- Transfers ownership as final step.
- Reads back public getters/mappings and fails hard on mismatch.

## 4) Optional dry-run on fork

If you already have a fork RPC endpoint, run migration against a local Truffle network wired to that fork, pinned at the snapshot block.

Example pattern (tooling-dependent):

1. Start an Anvil/Ganache fork at snapshot block.
2. Add/use a Truffle network config that points to the fork.
3. Run `truffle migrate --network <forkNetwork> --f 2 --to 2`.

## 5) Post-deploy verification checklist

On Etherscan **Read Contract** for the new deployment:

- Owner and all address fields (`agiToken`, `ens`, `nameWrapper`, `ensJobPages`).
- Roots/merkle roots.
- Validator/agent/economic/timing params.
- `paused`, `settlementPaused`, `lockIdentityConfig`.
- Mapping checks for known moderators/additionals/blacklisted addresses.
- AGI type entries by array index and payout percentage.

## 6) Etherscan verification with linked libraries

Use the existing repo flow documented in `docs/VERIFY_ON_ETHERSCAN.md` and provide library addresses emitted by migration logs. The migration prints all deployed library addresses needed for linked-bytecode verification.
