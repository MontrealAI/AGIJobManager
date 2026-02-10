# Quickstart

## Prerequisites
- Node.js and npm compatible with this repository.
- No secrets committed to the repo; use local `.env` only.

## Install
```bash
npm ci
```

## Compile
```bash
npm run build
```

## Run bytecode guard
```bash
npm run size
```

## Run tests
```bash
npm test
```

## Optional checks
```bash
npm run lint
npm run docs:interface
```

## Common troubleshooting
- **`truffle: not found`**: run `npm ci` again so `node_modules/.bin` is populated.
- **RPC/private key errors on live networks**: set env vars in `.env` (`PRIVATE_KEYS`, `<NETWORK>_RPC_URL`, optional `ALCHEMY_KEY`/`INFURA_KEY`) before using `truffle migrate --network <network>`.
- **Identity config changes failing with `ConfigLocked`**: `lockIdentityConfiguration()` is irreversible.
- **Withdraw failing while unpaused**: `withdrawAGI()` requires both `whenPaused` and `whenSettlementNotPaused`.
