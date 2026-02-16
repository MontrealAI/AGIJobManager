# Mainnet migration from legacy AGIJobManager

This guide deploys the new `contracts/AGIJobManager.sol` using a deterministic, hardcoded snapshot of the live legacy deployment at `0x0178B6baD606aaF908f72135B8eC32Fc1D5bA477`.

## Prerequisites

- Environment variables:
  - `MAINNET_RPC_URL` (optional; script defaults to a public read-only endpoint)
  - `ETHERSCAN_API_KEY` (recommended for ABI metadata fetch)
  - `PRIVATE_KEYS` (deployer key for Truffle)
  - `CONFIRM_MAINNET_DEPLOY=1` (required for live mainnet migration)
  - `NEW_OWNER` (optional ownership override)
- Funded deployer account for gas + library deployments.
- `npm ci` completed.

## 1) Generate deterministic snapshot (pin block)

```bash
node scripts/snapshotLegacyMainnetConfig.js --block 23000000
```

Output file:

- `migrations/snapshots/legacy.mainnet.0x0178B6baD606aaF908f72135B8eC32Fc1D5bA477.json`

The script:

- reads mainnet at the exact pinned block,
- records `chainId`, `blockNumber`, `blockTimestamp`,
- replays owner admin transactions deterministically (via ordered tx replay) to recover dynamic sets,
- compares values against provided hints and prints mismatches.

## 2) Review snapshot JSON

Before deploy, review:

- `addressConfig` (`owner`, `agiTokenAddress`, ENS addresses)
- `rootNodes` and `merkleRoots`
- `params` (thresholds/economic/time controls)
- `dynamicSets` (`moderators`, additional allowlists, blacklists)
- `agiTypes` list/order and payout values
- `extractionNotes` for fields not directly readable from legacy getters

All uint256 values are strings; addresses are checksummed.

## 3) Run migration safely

### Dry run (fork/local)

If you run a local fork on `127.0.0.1:8545`, deploy against `development` first:

```bash
truffle migrate --network development --f 2 --to 2
```

### Mainnet

```bash
CONFIRM_MAINNET_DEPLOY=1 truffle migrate --network mainnet --f 2 --to 2
```

Safety controls:

- migration verifies current `chainId` equals snapshot `chainId`,
- migration refuses mainnet unless `CONFIRM_MAINNET_DEPLOY=1`.

## 4) Post-deploy verification checklist

Use Etherscan “Read Contract” on new deployment:

- constructor config: `agiToken`, ENS registry/nameWrapper, root nodes, merkle roots
- booleans: `paused`, `settlementPaused`, `lockIdentityConfig`, `useEnsJobTokenURI`
- numeric params: approvals/disapprovals/quorum/reward/bonds/periods/payout limits
- dynamic sets: `moderators(addr)`, `additionalAgents(addr)`, `additionalValidators(addr)`, blacklist mappings
- ownership: `owner()`

Migration already performs on-chain readback assertions and fails loudly on mismatch.

## 5) Etherscan verification (linked libraries)

Use repo-standard plugin (`truffle-plugin-verify`) with configured API key:

```bash
truffle run verify AGIJobManager --network mainnet
```

Libraries are deployed/linked in migration (`BondMath`, `ENSOwnership`, `ReputationMath`, `TransferUtils`, `UriUtils`) before AGIJobManager deployment.
