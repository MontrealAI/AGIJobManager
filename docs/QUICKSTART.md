# Quickstart (15-30 minutes)

## Prerequisites

- Node.js 20+
- npm

## Commands

```bash
npm ci
npm run build
npm run test
npm run docs:gen
npm run docs:check
```

## Workflow command matrix

| Command | Outcome | When to use | Common failures |
| --- | --- | --- | --- |
| `npm ci` | Deterministic install from lockfile | Fresh clone, CI parity | Node version mismatch |
| `npm run build` | Compiles contracts with pinned Truffle/solc config | Before deploy/tests | Missing env variables in custom network setup |
| `npm run test` | Full contract and JS test run | Regression validation | Ganache process state or dependency corruption |
| `truffle migrate --network test` | Local deploy via migrations | Dry-run deployment wiring | Migration env mismatch |
| `npm run docs:gen` | Regenerates reference docs | Before commit | Missing source files |
| `npm run docs:check` | Verifies docs completeness/freshness/links | CI and pre-PR gate | Stale generated docs or broken links |
