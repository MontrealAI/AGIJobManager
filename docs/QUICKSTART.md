# Quickstart (15–30 minutes)

## 1) Install

```bash
npm ci
```

## 2) Compile

```bash
npm run build
```

## 3) Test

```bash
npm test
```

## 4) Docs integrity

```bash
npm run docs:gen
npm run docs:check
```

## 5) Optional UI smoke test

```bash
npm run test:ui
```

## Command catalog

| Command | Outcome | When to use | Common failures | Fix |
| --- | --- | --- | --- | --- |
| `npm ci` | Deterministic dependency install | Fresh clone / CI | Lockfile mismatch | Re-run on clean tree; avoid `npm install` drift in CI |
| `npm run build` | Truffle compile and artifacts | Before tests/deploy | Solidity compile errors | Fix compiler errors in contracts/tests, then rebuild |
| `npm test` | Contract + invariant/regression suites | Pre-PR safety gate | Local node/toolchain drift | Use Node 20 (CI baseline) and run `truffle compile --all` |
| `truffle migrate --network development --reset` | Local deployment for operator rehearsal | Before local runbooks or Etherscan prep drills | Ganache not running / wrong chain id | Start Ganache first and verify `truffle-config.js` network settings |
| `node scripts/postdeploy-config.js --network development` | Applies post-deploy owner/operator configuration | After deployment in rehearsals | Missing env values for addresses/roots | Populate only placeholder-safe `.env` values and validate args |
| `truffle exec scripts/ops/validate-params.js --network development --address <AGIJobManagerAddress>` | Parameter and wiring sanity checks on deployed instance | Before owner param changes | Missing `--address` / running outside Truffle context | Run via `truffle exec` and provide the deployed contract address |
| `npm run docs:check` | Verifies required docs freshness, links, Mermaid, SVG | Pre-PR for docs | Stale generated docs | Run `npm run docs:gen`, commit regenerated references |
