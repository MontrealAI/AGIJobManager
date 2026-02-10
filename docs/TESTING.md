# Testing Guide

## Canonical commands (from `package.json`)

- Build:
  ```bash
  npm run build
  ```
- Full test pipeline:
  ```bash
  npm test
  ```
  This runs compile, Truffle tests, `test/AGIJobManager.test.js`, and contract size checks.
- Lint:
  ```bash
  npm run lint
  ```
- Bytecode size gate:
  ```bash
  npm run size
  ```
- UI smoke:
  ```bash
  npm run test:ui
  ```

## Run a single test file

Use Truffle directly:

```bash
truffle test --network test test/<file>.test.js
```

Examples:

```bash
truffle test --network test test/deploymentDefaults.test.js
truffle test --network test test/ensJobPagesHooks.test.js
```

## Deterministic testing guidelines

- Reuse existing helpers under `test/helpers/`.
- Prefer explicit timestamps/time travel strategy already used in tests.
- Avoid relying on external RPC/network state.
- Keep ENS/ERC mocks from `contracts/test/` for isolated behavior coverage.

## Troubleshooting

- **Compile fails**: verify Node/npm install and pinned solc profile in `truffle-config.js`.
- **Network/provider issues**: use `--network test` for local deterministic Ganache provider.
- **Size gate failures**: run `npm run size` and inspect `scripts/check-bytecode-size.js` output.
- **UI smoke failures**: ensure Playwright browser dependencies are installed in CI-like environments.
