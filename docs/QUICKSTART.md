# Quickstart

## Prerequisites
- Node.js (LTS recommended)
- npm
- Git

## Install
```bash
npm ci
```

## Compile
```bash
npm run build
```

## Run full test workflow
```bash
npm test
```

`npm test` in this repo runs:
1. `truffle compile --all`
2. `truffle test --network test`
3. `node test/AGIJobManager.test.js`
4. `node scripts/check-contract-sizes.js`

## Run bytecode size guard directly
```bash
npm run size
```

## Common local commands
```bash
npm run lint
npm run docs:interface
npm run test:ui
```

## Local network option
```bash
npx ganache -p 8545
npx truffle migrate --network development
```

## Troubleshooting

### `truffle: not found`
- Cause: dependencies were not installed.
- Fix: run `npm ci`.

### Environment variables for deployment not set
- Deployment networks require `.env` values consumed by `truffle-config.js`.
- Copy and edit:
```bash
cp .env.example .env
```
- Use placeholders, e.g. `<MAINNET_RPC_URL>`, `<SAFE_PRIVATE_KEY>`.

### Bytecode too large
- `npm run size` / `scripts/check-contract-sizes.js` enforces EIP-170 runtime size limits.
- Reduce contract bytecode growth before release.
