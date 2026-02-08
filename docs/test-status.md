# Test status (local)

This file records the latest local test outcomes and any environment‑specific
failures. Warnings are treated as failures for audit readiness.

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
(`EBADPLATFORM`). The command also emitted `npm warn Unknown env config "http-proxy"`.

```bash
npm install --omit=optional
```
**Result:** succeeded, but emitted warnings treated as failures:
- `npm warn Unknown env config "http-proxy"`.
- Multiple deprecation warnings from transitive dependencies.
- `npm audit` reports vulnerabilities (27 low, 12 moderate, 19 high, 7 critical).

## Build + test commands
```bash
npx truffle compile
```
**Result:** succeeded, but emitted compiler warnings treated as failures:
- Name shadowing warning in `contracts/test/MockENSRegistry.sol` (`setOwner` argument).
- Name shadowing warning in `contracts/test/MockPublicResolver.sol` (`setAuthorisation` argument).
- Low‑level call return value unused in `contracts/AGIJobManager.sol` (`ensJobPages.call`).

```bash
npx truffle test
```
**Result:** failed with `CONNECTION ERROR: Couldn't connect to node http://127.0.0.1:8545`.
This happens because the default Truffle network expects a local node on port 8545.

```bash
npx truffle test --network test
```
**Result:** passed (`226 passing`).

**Smallest next fix (for the failing command):**
- Run tests against the configured in‑process Ganache network with
  `npx truffle test --network test`, or start a local JSON‑RPC node on
  `http://127.0.0.1:8545` before running `npx truffle test`.
