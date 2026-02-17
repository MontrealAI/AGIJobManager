# VERIFY_ON_ETHERSCAN

Etherscan usability (clear Read/Write forms + decoded errors/events) requires successful source verification.

## 1) Exact compiler settings used by this repo

From `truffle-config.js` (deployment path used by npm scripts):
- compiler: `solc 0.8.23`
- optimizer: enabled, `runs=50`
- `viaIR: true`
- EVM version: `london`
- metadata: `bytecodeHash: none`
- revert strings: `strip`

Foundry (`foundry.toml`) is used for forge tests and uses a different profile (`solc 0.8.19`). Do not verify a Truffle deployment with Foundry compile settings.

## 2) Build exactly as CI does

```bash
npm ci
npm run build
```

## 3) External library linking (mandatory)

`AGIJobManager` is linked against external libraries in migrations.
You must provide the deployed addresses for:
- `BondMath`
- `ENSOwnership`
- `ReputationMath`
- `TransferUtils`
- `UriUtils`

If any mapping is wrong, bytecode will not match and verification fails.

## 4) Verification options

### A) Truffle verify plugin

```bash
ETHERSCAN_API_KEY=... \
PRIVATE_KEYS=0x... \
MAINNET_RPC_URL=https://... \
npx truffle run verify AGIJobManager --network mainnet
```

### B) Etherscan Standard JSON Input

Use Standard JSON mode and set:
- exact compiler version
- optimizer/viaIR/evm settings above
- library name -> address mappings
- exact constructor arguments used in deployment

## 5) Common mismatch causes + fixes

- Wrong solc version (must match deployment compiler).
- Wrong optimizer runs.
- `viaIR` mismatch.
- Wrong EVM version.
- Metadata hash mismatch.
- Wrong constructor arguments.
- Wrong linked library addresses.

## 6) Verification success checklist

After verification on Etherscan:
1. `Read Contract` shows named functions with structured output.
2. `Write Contract` shows readable input fields.
3. Failed tx pages decode to custom errors (e.g., `InvalidState`, `NotAuthorized`).
4. Role docs in [`docs/ETHERSCAN_GUIDE.md`](ETHERSCAN_GUIDE.md) can be followed directly with on-screen function names.
