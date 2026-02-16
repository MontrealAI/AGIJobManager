# Mainnet migration from legacy AGIJobManager snapshot

This runbook deploys `contracts/AGIJobManager.sol` using a deterministic mainnet snapshot from the legacy live contract `0x0178B6baD606aaF908f72135B8eC32Fc1D5bA477`.

## Prerequisites

- Node dependencies installed (`npm ci`).
- A working Ethereum mainnet RPC endpoint in `MAINNET_RPC_URL`.
- Etherscan API key in `ETHERSCAN_API_KEY` (required by snapshot script for ABI and tx history).
- Deployer private key configured in `PRIVATE_KEYS` (see `truffle-config.js`).
- Funded deployer wallet for gas.
- Mainnet safety confirmation variable `CONFIRM_MAINNET_DEPLOY=1` (required on chainId 1).

## 1) Generate deterministic snapshot (pinned block)

```bash
MAINNET_RPC_URL="https://<your-mainnet-rpc>" \
ETHERSCAN_API_KEY="<your-key>" \
node scripts/snapshotLegacyMainnetConfig.js --block 23123456
```

Output file:

- `migrations/snapshots/legacy.mainnet.0x0178B6baD606aaF908f72135B8eC32Fc1D5bA477.json`

The snapshot includes:

- `source` metadata (chain, block, timestamp, proxy detection).
- constructor config (token/baseIpfs/ENS + root nodes + merkle roots).
- booleans and economic/timing params.
- replay-derived dynamic sets with source tx provenance:
  - moderators
  - additional agents/validators
  - blacklisted agents/validators
  - AGI types, preserving insertion order and disabled state.

## 2) Review snapshot before deployment

Checklist:

1. Confirm `source.blockNumber` is the intended pin.
2. Confirm all addresses are checksummed.
3. Confirm all uint values are JSON strings.
4. Compare printed hint checks in stdout (`MATCH` / `DIFF`) and investigate any unexpected differences.
5. Inspect `dynamic.*.source` tx hashes for sensitive entries.

## 3) Deploy from the committed snapshot (no runtime lookups)

This migration is opt-in and gated by `USE_LEGACY_SNAPSHOT_MIGRATION=1`.

```bash
MAINNET_RPC_URL="https://<your-mainnet-rpc>" \
PRIVATE_KEYS="0x<deployer-private-key>" \
USE_LEGACY_SNAPSHOT_MIGRATION=1 \
CONFIRM_MAINNET_DEPLOY=1 \
truffle migrate --network mainnet --f 2 --to 2
```

Optional owner override:

```bash
NEW_OWNER="0x<checksummed-owner>"
```

The migration:

- deploys and links required libraries,
- deploys `AGIJobManager` with snapshot constructor args,
- restores mutable config and dynamic sets,
- restores paused/settlement/identity lock state,
- transfers ownership at the end,
- runs read-back assertions and fails loudly on mismatch.

## 4) Optional fork dry-run

If your RPC supports forking with Ganache:

```bash
npx ganache --fork.url "$MAINNET_RPC_URL" --fork.blockNumber 23123456 --wallet.mnemonic "test test test test test test test test test test test junk"
```

Then in another shell:

```bash
MAINNET_RPC_URL="http://127.0.0.1:8545" \
PRIVATE_KEYS="0x<local-test-key>" \
USE_LEGACY_SNAPSHOT_MIGRATION=1 \
truffle migrate --network development --f 2 --to 2
```

> The migration enforces chainId match with snapshot (mainnet). For fork dry-runs, run with a chainId-compatible fork setup.

## 5) Post-deploy verification checklist

In Etherscan “Read Contract” for the new deployment:

- `owner`, `agiToken`, `ens`, `nameWrapper`
- `clubRootNode`, `agentRootNode`, `alphaClubRootNode`, `alphaAgentRootNode`
- `validatorMerkleRoot`, `agentMerkleRoot`
- parameters (`requiredValidatorApprovals`, `voteQuorum`, `validationRewardPercentage`, bond params, periods)
- flags (`paused`, `settlementPaused`, `lockIdentityConfig`)
- mapping spot checks for moderators/additionals/blacklists
- `agiTypes(i)` entries

## 6) Etherscan verification with linked libraries

Use the repo’s configured plugin (`truffle-plugin-verify`) after deployment. Ensure library addresses from migration logs are provided/recognized by the verify command flow in this repo.
