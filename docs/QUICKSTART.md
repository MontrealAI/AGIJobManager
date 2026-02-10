# Quickstart

## Purpose
Get a contributor from clean checkout to compile/test/size-guard with repository-supported commands.

## Audience
Developers and auditors doing local verification.

## Preconditions / assumptions
- Node.js + npm installed.
- No secrets committed; use local environment variables only.
- Run commands from repo root.

## Install dependencies
```bash
npm ci
```

## Build / compile
```bash
npm run build
```

## Run complete test pipeline
```bash
npm test
```

`npm test` runs:
- `truffle compile --all`
- `truffle test --network test`
- `node test/AGIJobManager.test.js`
- `node scripts/check-contract-sizes.js`

## Run explicit runtime-size guard
```bash
npm run size
```

## Optional checks
```bash
npm run lint
npm run docs:interface
```

## Local deployment (dev/test chain)
```bash
truffle migrate --network test --reset
```

## Live-network deployment skeleton
```bash
truffle migrate --network <mainnet|sepolia> --reset
node scripts/postdeploy-config.js --network <mainnet|sepolia> --address <AGIJOBMANAGER_ADDRESS>
node scripts/verify-config.js --network <mainnet|sepolia> --address <AGIJOBMANAGER_ADDRESS>
```

## Troubleshooting
- **`truffle: command not found`**: run `npm ci` and use local binaries via npm scripts.
- **Provider errors (`Missing RPC URL`, `Missing PRIVATE_KEYS`)**: configure env vars consumed by `truffle-config.js` (`<NETWORK>_RPC_URL` or Alchemy/Infura keys, and `PRIVATE_KEYS`).
- **`ConfigLocked` reverts**: `lockIdentityConfiguration()` permanently blocks identity wiring setters.
- **Withdrawal revert while unpaused**: `withdrawAGI()` requires both `whenPaused` and `whenSettlementNotPaused`.
- **Bytecode size failures**: run `npm run size` and inspect contract growth before deployment.

## Gotchas / failure modes
- `npm install` can drift lockfile resolution; prefer `npm ci` for reproducibility.
- `truffle test` on non-`test` network may produce misleading failures due to permissions/funding.

## References
- [`../package.json`](../package.json)
- [`../truffle-config.js`](../truffle-config.js)
- [`../scripts/check-bytecode-size.js`](../scripts/check-bytecode-size.js)
- [`../scripts/postdeploy-config.js`](../scripts/postdeploy-config.js)
- [`../scripts/verify-config.js`](../scripts/verify-config.js)
