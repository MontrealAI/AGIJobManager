# Testing

## Canonical commands
From repo root:
- `npm install`
- `npm run build`
- `npm run test`
- `npm run size`

`npm run test` executes compile, Truffle tests on network `test`, a direct Node test runner (`node test/AGIJobManager.test.js`), and contract size checks.

## Run a single test file
Use Truffle directly:
- `npx truffle test test/happyPath.test.js --network test`

## Deterministic test guidance
- Prefer fixtures in `test/helpers/` for reusable setup.
- Keep proof inputs/static addresses deterministic (see `test/helpers/ens.js`, merkle helper scripts).
- Avoid time-dependent flakes: use explicit time travel/helpers where needed.

## Troubleshooting
- **Compile mismatch**: ensure Truffle uses pinned compiler (`0.8.23`) from `truffle-config.js`.
- **Provider/env issues**: local tests use in-config Ganache test provider; external networks require env RPC + private keys.
- **Bytecode gate failure**: run `npm run size` and inspect `scripts/check-bytecode-size.js` output.
