# Mainnet deployment and verification

This document provides an actionable, operator‑focused deployment guide that
matches the current Truffle configuration and migrations.

## 1) Pre‑deploy checklist

- ✅ **Tests** pass locally (see Test status below).
- ✅ **No compiler warnings** during `npx truffle compile`.
- ✅ **Runtime bytecode ≤ 24,576 bytes** (EIP‑170).
- ✅ **Compiler version pinned** and reproducible.
- ✅ **Optimizer enabled** with documented runs.
- ✅ **viaIR disabled** (must remain off to reproduce bytecode).
- ✅ **Owner address** is a multisig (recommended).
- ✅ **ENS/NameWrapper/root nodes** and **token address** verified.

## 2) Build + verification requirements

**Compiler settings (source of truth: `truffle-config.js`)**
- `solc` version: **0.8.23**
- `optimizer`: enabled, `runs = 50`
- `viaIR`: `false`
- `metadata.bytecodeHash`: `none`
- `debug.revertStrings`: `strip`
- `evmVersion`: `london` (unless overridden by `SOLC_EVM_VERSION`)

**Bytecode size guard**
- `test/bytecodeSize.test.js` enforces a hard cap of **24,575 bytes**.
- `npm run size` executes `scripts/check-bytecode-size.js` for a local size check.

## 3) Deployment steps (Truffle)

**Install & compile**
```bash
npm ci
npx truffle compile
```

**Deploy (mainnet)**
```bash
npx truffle migrate --network mainnet
```

The deployment entrypoint is `migrations/1_deploy_contracts.js`. It uses
`migrations/deploy-config.js` to resolve constructor arguments and optionally
locks identity configuration if `LOCK_IDENTITY_CONFIG=true` or `LOCK_CONFIG=true`.

### Constructor arguments (from `buildInitConfig`)
1. `tokenAddress`
2. `baseIpfsUrl`
3. `[ensAddress, nameWrapperAddress]`
4. `[clubRootNode, agentRootNode, alphaClubRootNode, alphaAgentRootNode]`
5. `[validatorMerkleRoot, agentMerkleRoot]`

Mainnet defaults are defined in `migrations/deploy-config.js` and can be
overridden with environment variables:
- `AGI_TOKEN_ADDRESS`
- `AGI_ENS_REGISTRY`
- `AGI_NAMEWRAPPER`
- `AGI_CLUB_ROOT_NODE`
- `AGI_ALPHA_CLUB_ROOT_NODE`
- `AGI_AGENT_ROOT_NODE`
- `AGI_ALPHA_AGENT_ROOT_NODE`
- `AGI_VALIDATOR_MERKLE_ROOT`
- `AGI_AGENT_MERKLE_ROOT`
- `AGI_BASE_IPFS_URL`

## 4) Post‑deploy configuration sequence

1. **Confirm wiring**: token, ENS registry, NameWrapper, and root nodes.
2. **Set moderators** and required validator thresholds.
3. **Confirm Merkle roots** (or update with `updateMerkleRoots`).
4. **Tune parameters** (job duration, max payout, review periods).
5. **Lock identity configuration** with `lockIdentityConfiguration()`.

## 5) Etherscan verification

Truffle is configured with `truffle-plugin-verify`.

```bash
npx truffle run verify AGIJobManager --network mainnet
```

Verification must use **exactly** the compiler settings above and the exact
constructor arguments. If verification fails, re‑check:
- `solc` version and optimizer runs
- `metadata.bytecodeHash` setting
- Constructor argument ordering

## 6) Test status (local)

See [`docs/test-status.md`](test-status.md) for the latest commands, outcomes,
and environment limitations.
