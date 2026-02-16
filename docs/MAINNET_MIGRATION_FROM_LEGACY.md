# Mainnet migration from legacy AGIJobManager snapshot

This runbook deploys `contracts/AGIJobManager.sol` from a deterministic snapshot of legacy mainnet state (`0x0178B6baD606aaF908f72135B8eC32Fc1D5bA477`) with **no runtime chain/Etherscan lookups in migration**.

## Prerequisites

- Environment variables:
  - `MAINNET_RPC_URL` (read RPC for snapshot; deploy RPC for migration)
  - `ETHERSCAN_API_KEY` (preferred ABI source; snapshot script has Blockscout fallback)
  - `PRIVATE_KEYS` (deployer private key(s) for Truffle)
  - `CONFIRM_MAINNET_DEPLOY=1` (required safety confirmation on chainId 1)
  - `DEPLOY_FROM_LEGACY_SNAPSHOT=1` (enables snapshot migration, disables default deploy migration)
- Funded deployer on Ethereum mainnet.

## 1) Generate pinned snapshot

Example with explicit block pin:

```bash
MAINNET_RPC_URL=https://ethereum-rpc.publicnode.com \
ETHERSCAN_API_KEY=... \
node scripts/snapshotLegacyMainnetConfig.js --block 21663238
```

Output file:

- `migrations/snapshots/legacy.mainnet.0x0178B6baD606aaF908f72135B8eC32Fc1D5bA477.json`

## 2) Review snapshot before deploy

Review these fields carefully:

- `chainId`, `blockNumber`, `blockTimestamp`
- `config.owner`, `config.agiToken`, ENS + root nodes + merkle roots
- dynamic sets:
  - `dynamic.moderators`
  - `dynamic.additionalAgents`
  - `dynamic.additionalValidators`
  - `dynamic.blacklistedAgents`
  - `dynamic.blacklistedValidators`
  - `dynamic.agiTypes`
- provenance:
  - each dynamic entry has a `source` tx hash
  - replay metadata in `dynamic.replay`
- hint sanity section:
  - `sanity.differences`

## 3) Dry-run on local test chain

Use Truffle test network for migration logic smoke validation:

```bash
DEPLOY_FROM_LEGACY_SNAPSHOT=1 truffle migrate --network test --reset
```

> This validates migration flow and assertions, but does not reproduce live mainnet balances/nonces.

## 4) Mainnet deployment

```bash
DEPLOY_FROM_LEGACY_SNAPSHOT=1 \
CONFIRM_MAINNET_DEPLOY=1 \
MAINNET_RPC_URL=... \
PRIVATE_KEYS=0x... \
truffle migrate --network mainnet --reset
```

Optional ownership override (final transfer):

```bash
NEW_OWNER=0xYourSafeAddress \
DEPLOY_FROM_LEGACY_SNAPSHOT=1 \
CONFIRM_MAINNET_DEPLOY=1 \
MAINNET_RPC_URL=... \
PRIVATE_KEYS=0x... \
truffle migrate --network mainnet --reset
```

## 5) Post-deploy verification checklist

In Etherscan **Read Contract** for the new deployment:

- `owner`, `agiToken`
- `ens`, `nameWrapper`, `ensJobPages`
- `clubRootNode`, `agentRootNode`, `alphaClubRootNode`, `alphaAgentRootNode`
- `validatorMerkleRoot`, `agentMerkleRoot`
- threshold/economic params (`requiredValidatorApprovals`, `requiredValidatorDisapprovals`, `voteQuorum`, `validationRewardPercentage`, bond params, periods)
- boolean state (`paused`, `settlementPaused`, `lockIdentityConfig`)
- dynamic set membership checks (`moderators(addr)`, `additionalAgents(addr)`, `additionalValidators(addr)`, blacklist mappings)

Migration prints `all assertions passed` only after readback checks succeed.

## 6) Etherscan verification with linked libraries

Use the repo’s existing verification flow:

```bash
truffle run verify BondMath ENSOwnership ReputationMath TransferUtils UriUtils AGIJobManager --network mainnet
```

Ensure constructor arguments match snapshot values and linked library addresses printed by migration.
