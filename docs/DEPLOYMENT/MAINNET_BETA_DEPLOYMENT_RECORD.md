# Mainnet Beta Deployment Record (Institutional)

> **Intended operational audience:** AI agents execute protocol activity; humans act as owner/operator/supervisor only.

## Executive summary

This record captures the already deployed and verified AGIJobManager Mainnet Beta stack on Ethereum mainnet.

- Deployment footprint: 5 linked libraries + 1 AGIJobManager contract.
- Verification method: Etherscan Standard JSON Input (no flattening).
- Operational posture: intake paused (`pause()`), settlement not globally paused (`settlementPaused == false`) unless emergency.

## Canonical deployed addresses (Ethereum Mainnet)

| Contract | Address | Etherscan |
| --- | --- | --- |
| AGIJobManager | `0xEd4F83dD59A79811939fD30b7F9A1368E78e8e5C` | https://etherscan.io/address/0xEd4F83dD59A79811939fD30b7F9A1368E78e8e5C |
| BondMath | `0xf808d87590927a09b2F6D837498E694E01B70bb3` | https://etherscan.io/address/0xf808d87590927a09b2F6D837498E694E01B70bb3 |
| ENSOwnership | `0x5377351eb5Fb3Dc7eEfAf72D21A86F0B1f808C47` | https://etherscan.io/address/0x5377351eb5Fb3Dc7eEfAf72D21A86F0B1f808C47 |
| ReputationMath | `0x1aAf6533840816A4872EA365bb7D4dB31007B84a` | https://etherscan.io/address/0x1aAf6533840816A4872EA365bb7D4dB31007B84a |
| TransferUtils | `0x8005Bafe2E840a18Ee86feDA720256771AFfa679` | https://etherscan.io/address/0x8005Bafe2E840a18Ee86feDA720256771AFfa679 |
| UriUtils | `0x2ceFbEb2BD6f175D2D04CAc5320C6C7d4078bC29` | https://etherscan.io/address/0x2ceFbEb2BD6f175D2D04CAc5320C6C7d4078bC29 |

## Build + verification settings (must match exactly)

- solc `0.8.23`
- optimizer enabled, runs `40`
- `evmVersion = "shanghai"`
- `viaIR = false`
- `settings.metadata.bytecodeHash = "none"`
- `settings.debug.revertStrings = "strip"`

## Constructor arguments (verbatim beta profile)

Default constructor profile for the official Hardhat mainnet path:

```text
agiTokenAddress: 0xa61a3b3a130a9c20768eebf97e21515a6046a1fa
baseIpfsUrl:     https://ipfs.io/ipfs/
ensConfig (address[2]):
  [0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e, 0xD4416b13d2b3a9aBae7AcD5D6C2BbDBE25686401]
rootNodes (bytes32[4]):
  0x39eb848f88bdfb0a6371096249dd451f56859dfe2cd3ddeab1e26d5bb68ede16
  0x2c9c6189b2e92da4d0407e9deb38ff6870729ad063af7e8576cb7b7898c88e2d
  0x6487f659ec6f3fbd424b18b685728450d2559e4d68768393f9c689b2b6e5405e
  0xc74b6c5e8a0d97ed1fe28755da7d06a84593b4de92f6582327bc40f41d6c2d5e
merkleRoots (bytes32[2]):
  0x0effa6c54d4c4866ca6e9f4fc7426ba49e70e8f6303952e04c8f0218da68b99b
  0x0effa6c54d4c4866ca6e9f4fc7426ba49e70e8f6303952e04c8f0218da68b99b
```

### Reconciliation note with migration #6 defaults

Migration #6 defaults and beta constructor defaults are functionally aligned. The AGI token appears with checksum-casing in migration config (`0xA61a...1fA`) and lowercase in this beta profile (`0xa61a...1fa`), but both normalize to the same address value.

For release documentation context, the AGIALPHA token used in this repo version is:

- `0xA61a3B3a130a9c20768EEBF97E21515A6046a1Fa`


## Default FINAL_OWNER for recommended deployments

The default final owner used by the official Hardhat mainnet profile and `.env.example` is:

- `0xa9eD0539c2fbc5C6BC15a2E168bd9BCd07c01201` (`club.agi.eth`)

Operators can override this intentionally, but doing nothing keeps this default owner.

## Deployment narrative

- Mainnet deployment completed for libraries + AGIJobManager.
- During broader post-deploy write bursts, RPC provider throttling/rate limiting occurred.
- To preserve deterministic state, additional configuration was intentionally moved to manual, auditable Etherscan operations.
- Verification was completed through Etherscan Standard JSON Input with exact compiler settings listed above.

## Current state checklist (Etherscan Read Contract)

Confirm the following directly on Etherscan Read Contract:

1. `owner()`
2. `agiToken()`
3. `paused()`
4. `settlementPaused()`
5. `ens()`
6. `nameWrapper()`
7. `clubRootNode()`
8. `agentRootNode()`
9. `alphaClubRootNode()`
10. `alphaAgentRootNode()`
11. `validatorMerkleRoot()`
12. `agentMerkleRoot()`
13. `requiredValidatorApprovals()`
14. `requiredValidatorDisapprovals()`
15. `voteQuorum()`
16. `validationRewardPercentage()`
17. `validatorBondBps()`
18. `validatorSlashBps()`
19. `validatorBondMin()`

Beta posture target:

- `paused() == true` via `pause()` (do not use `pauseAll()` for this intent)
- `settlementPaused() == false` except emergency response

## Manual actions via Etherscan (Write Contract)

> Owner-only operations; execute from current owner account.

### 1) Pause intake (beta intent)

- Call `pause()` if `paused()` is currently false.
- Do **not** call `pauseAll()` for standard beta intake pause posture.

### 2) Optional beta AGI type

```text
addAGIType(0x3e70227D9c1d02F48CA5c90DFf7a6cAbFb5934f3, 80)
```

### 3) Recommended beta validator targets (manual tuning targets)

- approvals = `5`
- disapprovals = `5`
- voteQuorum = `7`
- validationRewardPercentage = `8`
- validatorBondBps = `1500`
- validatorSlashBps = `8000`
- validatorBondMin = `100e18` (`100000000000000000000`)

Corresponding write calls:

- `setRequiredValidatorApprovals(5)`
- `setRequiredValidatorDisapprovals(5)`
- `setVoteQuorum(7)`
- `setValidationRewardPercentage(8)`
- `setValidatorBondParams(1500, 100000000000000000000, <policy_max>)`
- `setValidatorSlashBps(8000)`

### 4) Ownership transfer

```text
transferOwnership(finalOwner)
```

Then verify with `owner()` readback.

## Verification fallback (Standard JSON Input)

If API/plugin verification fails, verify manually with:

1. `solc-input.json` (from deployment artifacts)
2. exact settings listed in this document
3. `verify-targets.json` for fully-qualified contract names + addresses

This is the durable fallback path for institutional operations when automation is unavailable.

## Legal note

This document is operational guidance only and not legal advice.

Authoritative legal/terms source remains embedded in:

- [`contracts/AGIJobManager.sol`](../../contracts/AGIJobManager.sol)
