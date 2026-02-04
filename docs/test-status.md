# Test status (local)

This file records the latest local test outcomes and any environment‑specific failures.

## Environment
- OS: Linux (container)
- Node: v20.19.6
- Truffle: v5.11.5
- Solidity (solc‑js): 0.8.23

## Install status
```bash
npm ci
```
**Result:** failed on Linux because `fsevents@2.3.2` is macOS‑only (`EBADPLATFORM`).

**Workaround used:**
```bash
npm install --omit=optional
```

## Test commands
```bash
npx truffle version
```
**Result:** succeeded.

```bash
npx truffle compile
```
**Result:** succeeded (no compiler warnings emitted).

```bash
npx truffle test
```
**Result:** failed to connect to `http://127.0.0.1:8545`.

**What the failure means:**
- This command targets the default `development` network, which expects a local JSON‑RPC node at 127.0.0.1:8545.

**Smallest next fix:**
- Start Ganache locally (`npx ganache -p 8545`), **or** run tests with the in‑process provider:
  ```bash
  npx truffle test --network test
  ```

```bash
npx truffle test --network test
```
**Result:** succeeded (216 passing).
