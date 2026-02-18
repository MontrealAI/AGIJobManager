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

## 4) Local deploy rehearsal

```bash
truffle migrate --network development --reset
```

## 5) Documentation integrity

```bash
npm run docs:gen
npm run docs:check
```

## 6) Optional UI smoke test

```bash
npm run test:ui
```

## Command catalog

| Command | Outcome | When to use | Common failures | Fix |
| --- | --- | --- | --- | --- |
| `npm ci` | Deterministic dependency install | Fresh clone / CI | Lockfile mismatch | Re-run with clean lockfile and Node version parity |
| `npm run build` | Truffle compile and artifacts | Before tests/deploy | Solidity compile errors | Inspect compiler diagnostics and contract imports |
| `npm test` | Contract + invariant/regression suites | Pre-PR safety gate | Local node/toolchain drift | Reinstall deps and ensure Ganache/Truffle versions match lockfile |
| `truffle migrate --network development --reset` | Local deployment rehearsal | Validate migration path end-to-end | Missing local chain or wrong network config | Start Ganache and confirm `truffle-config.js` network settings |
| `node scripts/ops/validate-params.js --help` | Parameter schema guidance | Before owner param changes | Invalid bounds/input format | Correct parameter package before signing owner txs |
| `npm run docs:check` | Verifies required docs freshness, links, Mermaid, SVG | Pre-PR for docs | Stale generated docs | Run `npm run docs:gen` and recommit generated outputs |
