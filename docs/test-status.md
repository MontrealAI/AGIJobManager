# Test status (local)

This file records the latest local test outcomes and any environment‑specific
failures. Warnings are treated as failures for audit readiness.

## Environment
- OS: Linux (container)
- Node: v20.19.6
- Truffle: v5.11.5
- Ganache: v7.9.1
- Solidity (solc‑js): 0.8.23

## Install status
```bash
npm install
```
**Result:** succeeded, but emitted warnings treated as failures:
- `npm warn Unknown env config "http-proxy"`.
- Multiple deprecation warnings from transitive dependencies.
- `npm audit` reports vulnerabilities (28 low, 12 moderate, 35 high, 13 critical).

## Build + test commands
```bash
npm run build
```
**Result:** succeeded, but emitted compiler warnings treated as failures:
- Name shadowing warning in `contracts/test/MockENSRegistry.sol` (`setOwner` argument).
- Name shadowing warning in `contracts/test/MockPublicResolver.sol` (`setAuthorisation` argument).

```bash
npm test
```
**Result:** passed (`226 passing`), but emitted warnings treated as failures:
- `npm warn Unknown env config "http-proxy"`.
- The same compiler warnings from `npm run build`.
