# Verify on Etherscan (Exact Repo Settings)

Etherscan Read/Write usability depends on successful source verification.

## 1) Toolchain settings used in this repo

## Truffle compile/deploy profile (`truffle-config.js`)
- `solc`: `0.8.23`
- optimizer: enabled, runs `50`
- `viaIR: true`
- `evmVersion: london`
- `metadata.bytecodeHash: none`
- `debug.revertStrings: strip`

## Foundry profile (`foundry.toml`)
- `solc`: `0.8.19`
- optimizer: enabled, runs `50`
- `evm_version: london`

If deployment was done with Truffle scripts, verify with the Truffle profile.

## 2) Build exactly

```bash
npm install
npm run build
```

## 3) Linked libraries (required)

AGIJobManager is externally linked to:
- `UriUtils`
- `TransferUtils`
- `BondMath`
- `ReputationMath`
- `ENSOwnership`

Verification must include exact library-name → deployed-address mappings used at deployment time.

## 4) Verification methods

## A) Truffle plugin

```bash
ETHERSCAN_API_KEY=... \
PRIVATE_KEYS=0x... \
MAINNET_RPC_URL=https://... \
npx truffle run verify AGIJobManager --network mainnet
```

## B) Manual Standard JSON input
Use exact compiler settings + source set + library mappings + constructor args.

## 5) Common mismatch causes

- Wrong compiler version.
- Optimizer runs mismatch.
- `viaIR` mismatch.
- EVM version mismatch.
- Metadata hash mismatch.
- Wrong linked library addresses.
- Wrong constructor args.

## 6) Post-verification check

On Etherscan contract page:
1. Read tab shows typed outputs.
2. Write tab shows named fields.
3. Transaction details decode custom errors/events.
