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

| Command | Outcome | When to use | Common failures |
| --- | --- | --- | --- |
| `npm ci` | Deterministic dependency install | Fresh clone / CI | Lockfile mismatch |
| `npm run build` | Truffle compile and artifacts | Before tests/deploy | Solidity compile errors |
| `npm test` | Contract + invariant/regression suites | Pre-PR safety gate | Local node/toolchain drift |
| `node scripts/ops/validate-params.js --help` | Parameter schema guidance | Before owner param changes | Invalid bounds/input format |
| `npm run docs:check` | Verifies required docs freshness, links, Mermaid, SVG | Pre-PR for docs | Stale generated docs |
