# VERIFY_ON_ETHERSCAN

Etherscan Read/Write usability depends on successful source verification.

## 1) Compilation settings (must match deployment)

From `truffle-config.js` deployment path:
- compiler: `solc 0.8.23`
- optimizer: enabled, `runs = 50`
- `viaIR = true`
- EVM version: `london`
- metadata bytecode hash: `none`
- revert strings: `strip`

Foundry settings in `foundry.toml` are for forge tests and are not the canonical truffle deployment profile.

## 2) Build exactly as CI/deploy path

```bash
npm ci
npm run build
```

## 3) Externally linked libraries

AGIJobManager requires linked library addresses during verification. Supply exact deployed addresses for:
- `UriUtils`
- `TransferUtils`
- `BondMath`
- `ReputationMath`
- `ENSOwnership`

If any library mapping is wrong, bytecode mismatch is expected.

## 4) Verification options

### Option A: Truffle verify plugin

```bash
ETHERSCAN_API_KEY=... \
PRIVATE_KEYS=0x... \
MAINNET_RPC_URL=https://... \
npx truffle run verify AGIJobManager --network mainnet
```

### Option B: Etherscan Standard JSON input

Use standard-json mode with the exact settings above and explicit library name -> address mapping.

## 5) Troubleshooting common mismatches

- Wrong compiler version (must be `0.8.23` for truffle deployment)
- Wrong optimizer run count (`50`)
- Wrong `viaIR` flag
- Wrong EVM version (`london`)
- Wrong metadata hash mode (must be `none`)
- Wrong constructor args
- Wrong linked library addresses
- Compiling with foundry profile then verifying truffle deployment artifacts

## 6) Post-verification checklist

1. Etherscan `Read Contract` shows named methods.
2. Etherscan `Write Contract` input fields are readable and typed.
3. tx pages decode events and custom errors.
4. Role-guide examples in [`docs/ETHERSCAN_GUIDE.md`](ETHERSCAN_GUIDE.md) now map to visible function signatures.

## 7) Reproducible local verification prep commands

```bash
npm ci
npm run build
npx truffle compile --all
```

Then verify against the deployed AGIJobManager address using either plugin or Etherscan Standard JSON input.

Tip: read linked library addresses from deployment artifacts/tx logs and keep exact case-sensitive library names (`UriUtils`, `TransferUtils`, `BondMath`, `ReputationMath`, `ENSOwnership`).
