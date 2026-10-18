# Optional AGIJobPages metadata router

This is the generic metadata router, not the ENS namespace-owning ENSJobPages helper. It remains optional. Its Solidity behavior is unchanged. Development tests and exact-source explorer verification are separate checks; neither proves security or authorizes attachment or paid intake.

## Reviewed plan

Compile the exact source separately from preserved deployed-instance evidence. Save a reviewed JSON file (not a signer file):

```json
{
  "schema": "reviewed-job-pages-v2",
  "creator": "REVIEWED_EOA_CREATOR_ADDRESS",
  "transactionMode": "eoa-create",
  "chainId": 1,
  "owner": "REVIEWED_ROUTER_AND_MANAGER_OWNER",
  "manager": "REVIEWED_MANAGER_ADDRESS",
  "managerCodeHash": "REVIEWED_0x_RUNTIME_HASH",
  "buildDigest": "REVIEWED_64_HEX_COMPILER_INPUT_DIGEST",
  "baseMetadataURI": "ipfs://REVIEWED_CID/",
  "externalUrlBase": ""
}
```

Placeholders deliberately fail validation. `buildDigest` is SHA-256 of canonical sorted-key JSON `{input: buildInfo.input, solcLongVersion: buildInfo.solcLongVersion}` from the intact reviewed router build, as computed by exported `qualifiedArtifact`. Review that exact standard compiler input and compiler identity before recording the digest; merely computing a candidate digest does not approve it. The manager’s `owner()` must match the reviewed `owner` governor, with zero `pendingOwner()`, matching runtime, canonical USDC and paused intake. Current Manager creation assigns this governor atomically; historical handovers and later voluntary Manager transfers retain their own two-step semantics. The router’s independent `creator` is the transaction sender, and `transactionMode` must be `eoa-create` with empty creator account code. The configured signer must equal that creator, not necessarily the governor. The constructor assigns the router directly to `owner`; its three arguments are `[baseMetadataURI, externalUrlBase, owner]`. The creator may deliberately equal the governor, but creator status alone confers no owner authority. A multisignature governor can remain owner while a separately reviewed EOA creates the router; it need not directly sign this creation.

From `hardhat/`, use the pinned project CLI:

```bash
ROUTER_CONFIG=/absolute/reviewed-router.json DRY_RUN=1 \
node ../node_modules/hardhat/dist/src/cli.js --config ../hardhat.config.mjs \
run --no-compile scripts/deploy-job-pages.js --network mainnet
```

The default is read-only: no signer lookup, explorer submission, journal writes, ownership changes or manager attachment. The RPC must support EIP-1898 canonical hash reads; unsupported endpoints fail closed. Configuration paths are resolved from the current working directory. Sepolia uses `--network sepolia` and a reviewed chain11155111 configuration; it is an available path, not a claim that the scoped second deployment performed a Sepolia rehearsal.

## Separately authorized deployment

After reviewing the printed plan and deployment authorization, set `DRY_RUN=0`, a new absolute `ROUTER_JOURNAL` path and `DEPLOY_CONFIRM_MAINNET=I_UNDERSTAND_MAINNET_DEPLOYMENT`. The existing configured signer must equal the reviewed `creator`. Set `DEPLOYMENT_LOCK_DIRECTORY` to the operator-selected existing shared creator nonce-lock directory; unresolved locks require reconciliation, not automatic deletion. `ETHERSCAN_API_KEY` is required before broadcast; never include it in config, journals or published reports. The script reserves an exclusive journal, saves exact standard compiler input, estimates bounded initcode/gas and sends only the constructor transaction. `VERIFY=false` is rejected.

Success means `verified_unconfigured`: canonical confirmed transaction, exact constructor calldata/sender/create address, exact runtime, unchanged constructor state and explicit exact-source explorer success. The router has the explicit governor as `owner()` and `jobManager=0`; it is not attached to the manager. The returned governor action plan proposes `setJobManager` but executes no configuration, ownership transfer or attachment. Preserve the journal and adjacent `.solc-input.json`. A failure can follow a broadcast: do not run a fresh deployment to repair verification.

## Keyless verification recovery

Use the original journal, matching original compiler output and reviewed config. Choose a new exclusive output filename:

```bash
ROUTER_CONFIG=/absolute/reviewed-router.json \
ROUTER_JOURNAL=/absolute/original-router.json \
ROUTER_REPORT=/absolute/router-reverified.json \
ROUTER_REVERIFY=1 DRY_RUN=0 \
node ../node_modules/hardhat/dist/src/cli.js --config ../hardhat.config.mjs \
run --no-compile scripts/deploy-job-pages.js --network mainnet
```

Here `DRY_RUN=0` explicitly permits submitting public source to the explorer. No signer is requested and no blockchain transaction is sent. The original journal is unchanged. Missing broadcast hash/address requires transaction reconciliation before this path can proceed; do not invent receipt fields. Changed owner or already configured router also requires reconciliation, not a false initial-state success. Current recovery requires the original v2 config/journal, three-argument constructor and exact creator/governor binding. It does not repeat creation or perform a governor action.

Authentic historical `reviewed-job-pages-v1` configurations and `agi-job-pages-deployment-v1` journals are **recovery-only**. Supply their original two-argument artifact and compiler build through `ROUTER_LEGACY_ARTIFACT` and `ROUTER_LEGACY_BUILD_INFO`, together with the matching original config/journal and a new recovery report. The legacy source had the deployer as its constructor owner; the original creator transaction must therefore match that recorded owner. Do not upgrade a historical config to v2, invent a creator/governor, append a constructor argument or substitute current source to obtain verification. The legacy branch preserves its recorded ABI limitations, including an unavailable Manager URI-mode getter.

## Owner attachment remains separate

Verify the receipt, intended manager, metadata behavior and current state. Review any existing `ensJobPages` route before replacing it; the plan records the existing helper and routing flag. Only after explicit owner authorization should the owner set the router's manager, review `previewTokenURI`/URI fallback behavior, and separately attach/enable it on AGIJobManager. Preserve the original route for rollback. This script does not perform those configuration transactions or open intake.

The ordinary instance readiness and activation gates still apply. Contract source/tests, static findings and invariant scope must remain in the production verification inventory even when this optional router is not selected. Live verification is pending until an authorized deployment actually produces per-address evidence; fixture tests are not an explorer receipt.
