# Quickstart

## Purpose
Get a contributor from clone to compile and test with commands that exist in this repository.

## Audience
Developers and reviewers.

## Preconditions
- Node.js + npm installed.
- No production secrets required for local `test` network.

## Install
```bash
npm ci
```

## Compile
```bash
npm run build
```

## Size Guard
```bash
npm run size
```

## Test Suite
```bash
npm test
```

## Optional checks
```bash
npm run lint
npm run ui:abi:check
```

## Local migration (development network)
```bash
npx truffle migrate --network development
```

## Troubleshooting
- **`Missing RPC URL` / `Missing PRIVATE_KEYS`**: only required for `sepolia`/`mainnet` in `truffle-config.js`; use `--network test` locally.
- **Bytecode cap failures**: run `npm run size` and inspect `scripts/check-bytecode-size.js`.
- **Unexpected URI validation errors**: `UriUtils` rejects empty and whitespace/newline/tab URIs.
- **Ganache behavior mismatch**: repo test network uses in-process Ganache provider configured in `truffle-config.js`.

## Gotchas
- `npm test` already includes compile, Truffle tests, node tests, and contract size checks.
- Do not change `truffle-config.js` compiler settings just to “make docs pass”; docs should reflect pinned settings.

## References
- [`../package.json`](../package.json)
- [`../truffle-config.js`](../truffle-config.js)
- [`../scripts/check-bytecode-size.js`](../scripts/check-bytecode-size.js)
