# Test status (local)

This file records the latest local test outcomes and any environment‑specific
failures.

## Environment
- OS: Linux (container)
- Node: v20.19.6
- Truffle: v5.11.5
- Solidity (solc‑js): 0.8.23

## Install status
```bash
npm ci
```
**Result:** failed on Linux because `fsevents@2.3.2` is macOS‑only
(`EBADPLATFORM`). No dependency install succeeded, so Truffle config dependencies
(`dotenv`) were unavailable.

## Test commands
```bash
npx truffle compile
```
**Result:** failed with `Error: Cannot find module 'dotenv'` because dependencies
were not installed. The `npx` bootstrap also emitted multiple `npm warn` deprecation
messages while installing Truffle, which should be treated as warnings.

```bash
npx truffle test
```
**Result:** failed with `Error: Cannot find module 'dotenv'` because dependencies
were not installed.

**Smallest next fix:**
- Install dependencies without the macOS‑only optional package (e.g., via an
  `npm install` workflow that omits optional deps), then rerun `npx truffle compile`
  and `npx truffle test --network test`.
