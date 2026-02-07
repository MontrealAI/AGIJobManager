# Known issues

This file tracks reproducible failures in local commands or tests.

## `npm ci` fails on Linux due to macOS‑only optional dependency

**Reproduction**
```bash
npm ci
```

**Failure**
```
npm error notsup Unsupported platform for fsevents@2.3.2: wanted {"os":"darwin"} (current: {"os":"linux"})
```

**Root cause**
`fsevents` is a macOS‑only optional dependency; `npm ci` treats it as required
and fails on Linux in this environment.

**Smallest fix**
- Use an install path that omits optional dependencies (without touching
  `package-lock.json`), then rerun `npm ci` when appropriate in a macOS
  environment.

## `npx truffle compile` / `npx truffle test` fail with missing `dotenv`

**Reproduction**
```bash
npx truffle compile
# or
npx truffle test
```

**Failure**
```
Error: Cannot find module 'dotenv'
```

**Root cause**
Dependencies were not installed because `npm ci` failed, leaving `dotenv`
missing for `truffle-config.js`.

**Smallest fix**
- Install dependencies in a way that omits the macOS‑only optional package, then
  rerun `npx truffle compile` and `npx truffle test --network test`.

## `npm test` fails because `truffle` is missing

**Reproduction**
```bash
npm test
```

**Failure**
```
sh: 1: truffle: not found
```

**Root cause**
`npm ci` failed, so `truffle` (a dev dependency) was not installed.

**Smallest fix**
- Resolve the `npm ci` Linux failure above, then rerun `npm test`.
