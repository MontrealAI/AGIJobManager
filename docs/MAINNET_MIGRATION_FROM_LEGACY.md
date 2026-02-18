# Mainnet migration from legacy AGIJobManager snapshot

This runbook deploys `contracts/AGIJobManager.sol` from a deterministic, committed snapshot of the live legacy mainnet contract `0x0178B6baD606aaF908f72135B8eC32Fc1D5bA477`.

Artifacts in this repo:

- Snapshot extractor: `scripts/snapshotLegacyMainnetConfig.js`
- Committed snapshot: `migrations/snapshots/legacy.mainnet.0x0178B6baD606aaF908f72135B8eC32Fc1D5bA477.json`
- Hardcoded migration: `migrations/2_deploy_agijobmanager_from_legacy_snapshot.js`

## 1) Prerequisites

Required environment variables:

- `MAINNET_RPC_URL` (read-only snapshot RPC; migration RPC is from Truffle network config)
- `ETHERSCAN_API_KEY` (ABI/source + tx/event reconstruction)
- `PRIVATE_KEYS` (funded deployer key for Truffle mainnet network)

Safety gates:

- `CONFIRM_MAINNET_DEPLOY=1` is mandatory when `chainId == 1`.
- Optional owner override: `NEW_OWNER=0x...` (checksummed address).

## 2) Generate deterministic snapshot (pin a block)

Example pinned extraction:

```bash
MAINNET_RPC_URL=https://ethereum-rpc.publicnode.com \
ETHERSCAN_API_KEY=... \
node scripts/snapshotLegacyMainnetConfig.js --block 24480106
```

Default block is `latest` if `--block` is omitted.

The snapshot records:

- `schemaVersion`, `generatedAt`
- `snapshot.chainId`, `snapshot.blockNumber`, `snapshot.blockTimestamp`
- constructor config (token/baseIpfs/ENS/nameWrapper/root nodes/merkle roots)
- runtime config (owner, paused/settlementPaused/lockIdentityConfig, economic + timing params)
- dynamic sets (moderators/additionals/blacklists) with provenance
- AGI types as `{ nftAddress, payoutPercentage, enabled, source }`

If any required state cannot be recovered deterministically, the script exits with a hard error.

## 3) Review snapshot before deploy

```bash
cat migrations/snapshots/legacy.mainnet.0x0178B6baD606aaF908f72135B8eC32Fc1D5bA477.json
```

Review at minimum:

- owner + core addresses (`agiToken`, ENS, NameWrapper)
- root nodes + merkle roots
- paused/settlement/identity lock booleans
- validator threshold/quorum/reward/bond/slash/timing params
- dynamic set counts and members
- AGI type ordering and payout percentages

## 4) Migration dry-run on a fork/local chain (recommended)

If you have a local fork configured as `development`/`test`, run migration step 2 only:

```bash
MIGRATE_FROM_LEGACY_SNAPSHOT=1 \
truffle migrate --network development --f 2 --to 2
```

Expected output includes library addresses, deployed `AGIJobManager` address, and `All assertions passed for mainnet legacy parity.`

## 5) Mainnet deploy from committed snapshot

```bash
MIGRATE_FROM_LEGACY_SNAPSHOT=1 \
CONFIRM_MAINNET_DEPLOY=1 \
MAINNET_RPC_URL=... \
PRIVATE_KEYS=... \
truffle migrate --network mainnet --f 2 --to 2
```

Notes:

- Migration uses **no runtime RPC/Etherscan lookups** for configuration replay.
- It restores constructor config, runtime params, dynamic sets, AGI types, pause flags, identity lock, then ownership.
- It executes post-deploy read-back assertions and fails loudly on mismatch.

## 6) Post-deploy verification checklist (Etherscan Read Contract)

Confirm:

- `owner`, `agiToken`, `ens`, `nameWrapper`
- `clubRootNode`, `agentRootNode`, `alphaClubRootNode`, `alphaAgentRootNode`
- `validatorMerkleRoot`, `agentMerkleRoot`
- `paused`, `settlementPaused`, `lockIdentityConfig`
- `requiredValidatorApprovals`, `requiredValidatorDisapprovals`, `voteQuorum`
- `validationRewardPercentage`, `maxJobPayout`, `jobDurationLimit`
- `completionReviewPeriod`, `disputeReviewPeriod`
- `validatorBondBps/min/max`, `agentBondBps/min/max`, `validatorSlashBps`
- dynamic set membership via public mappings
- `agiTypes(i)` entries by index and payout

Known getter limitation: `baseIpfsUrl` is not directly readable from a public getter.
`useEnsJobTokenURI` / `ensJobPages` are asserted when their getters exist in the deployed bytecode.

## 7) Etherscan verification with linked libraries

Use the repository’s standard verification flow and pass:

- the exact constructor args used in deployment
- the linked library addresses printed by migration logs (`UriUtils`, `TransferUtils`, `BondMath`, `ReputationMath`, `ENSOwnership`)
