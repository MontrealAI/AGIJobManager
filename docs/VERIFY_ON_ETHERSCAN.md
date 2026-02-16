# VERIFY_ON_ETHERSCAN

Etherscan Read/Write usability depends on successful source verification.

## 1) Compiler settings used by this repo

From `truffle-config.js` (deployment path used by npm scripts):
- solc: `0.8.23`
- optimizer: enabled, `runs: 50`
- `viaIR: true`
- EVM version: `london`
- metadata bytecode hash: `none`
- revert strings: `strip`

Foundry profile in `foundry.toml` exists for forge tests and differs (`solc 0.8.19`). Do not mix profiles when verifying Truffle deployments.

## 2) Build exactly

```bash
npm ci
npm run build
```

## 3) External library linking (required)

AGIJobManager links external libraries. Provide exact deployed addresses for:
- `UriUtils`
- `TransferUtils`
- `BondMath`
- `ReputationMath`
- `ENSOwnership`

If library mapping is wrong, verification will fail.

## 4) Verification methods

### A) Truffle plugin path

```bash
ETHERSCAN_API_KEY=... \
PRIVATE_KEYS=0x... \
MAINNET_RPC_URL=https://... \
npx truffle run verify AGIJobManager --network mainnet
```

### B) Standard JSON input

Use Etherscan Standard JSON mode with the same compiler settings and explicit library mapping.

## 5) Troubleshooting mismatches

- Wrong solc version (`0.8.23` expected for Truffle deployment)
- Wrong optimizer runs (must be 50)
- Wrong `viaIR` (must match deployment)
- Wrong EVM version (`london`)
- Metadata hash mode mismatch (`none` expected)
- Wrong constructor args
- Wrong linked library addresses

## 6) Post-verify checks

On Etherscan:
1. `Read Contract` shows named methods.
2. `Write Contract` shows typed fields.
3. tx details decode custom errors/events cleanly.
