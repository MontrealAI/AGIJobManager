# Existing-deployment verification and readiness

This is a software recovery guide, not a deployment or activation procedure. Work from the root of the **reviewed existing deployment checkout**, with its saved build intact. Keep the original files and a protected offline backup. No private key is required for the following verification or readiness reads.

## 1. Preserve the build and choose the receipt

Use the exact journal recorded by deployment; do not select a receipt by newest filename, copy example addresses into production, or edit a failed status into success. Check chain ID, manager, owner, constructor settings and library addresses against the original evidence. Keep secrets and private configuration out of commits and shared diagnostics.

From the source root, receipt paths below are relative to `hardhat/` because npm runs the command there:

```bash
DEPLOYMENT_RECEIPT='deployments/mainnet/YOUR_ORIGINAL_RECEIPT.json' \
  npm --prefix hardhat run reverify:mainnet
```

The recovery command uses the saved artifacts without an automatic compile. It validates canonical creation receipts, deployer, constructor bytes, runtime, links, configured owner and paused intake, and rechecks explorer records. It writes a separate `.reverified.<block>.json` only on success. It sends no blockchain transactions. Keep the original receipt even after recovery.

## 2. Ownership is a separate, explicit two-step action

Read `owner()`, `pendingOwner()` and `paused()` on the correct chain and manager before any signing. Only when needed, the current owner proposes `transferOwnership(reviewedFinalOwner)` and the proposed owner accepts via `acceptOwnership()`. A previously recorded proposal does not prove current state. Do not repeat already completed transactions. These writes need the respective wallet and gas; neither recovery nor readiness submits them.

## 3. Review the complete NFT policy

`hardhat/reviewed-nft-policy.json` states expected policy. It does not set chain state. Retain all registered entries, including disabled collections with score `"0"`. For a genuinely unchanged fresh optional policy:

```json
{"agentNftRequired": false, "agiTypes": []}
```

Required NFT policy needs at least one enabled reviewed collection. Do not add a dummy collection or disable a requirement to silence a reader error.

## 4. Run the standard readiness command

```bash
DEPLOYMENT_RECEIPT='deployments/mainnet/YOUR_RECOVERED_RECEIPT.json' \
READINESS_NFT_CONFIG='./reviewed-nft-policy.json' \
  npm --prefix hardhat run check:readiness
```

Use `reverify:sepolia` / `check:readiness:sepolia` with a Sepolia receipt for a testnet instance. Any reviewed identity override belongs in a separate `READINESS_CONFIG` file, not the original receipt.

The normal checker now includes the compiler-derived registry reader. It recompiles **in memory only**, using the installed matching compiler, then requires exact rebuilt bytecode/ABI/link identity before accepting a length slot. Slot 59 is historical evidence for the recorded build, not a universal hardcoded slot. Valid entries are read at a pinned block; generic RPC errors are never interpreted as empty registry evidence. Expected and observed policy must match exactly.

A successful report ends in `.readiness.<block>.json`. It records current owner, zero pending owner, paused intake, code hashes, reviewed identity/NFT policy, accounting and USDC operational checks. Explorer verification is taken from the recovered receipt; readiness does not issue a new explorer query. The original journal's old ownership fields remain historical; the readiness report records current ownership.

## 5. Stop before activation

Do not interpret `checksPassed: true` as security certification, complete commissioning or permission to unpause. Review all remaining mutable limits/bonds/moderators, participant routes, monitoring, incident response and operator requirements. Rehearse the lifecycle, recheck changed state and authorize activation separately. There is no activation step in these commands.

An older operator-installed alternate checker may be retained as historical recovery tooling, but new v1.14.0 checkouts use the standard command. Do not overwrite a working deployment workspace with a candidate archive to obtain the fix: review the small source diff and preserve its existing artifacts/configuration.
