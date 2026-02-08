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

## `npx truffle test` fails without a local JSON‑RPC node

**Reproduction**
```bash
npx truffle test
```

**Failure**
```
> Something went wrong while attempting to connect to the network at http://127.0.0.1:8545.
CONNECTION ERROR: Couldn't connect to node http://127.0.0.1:8545.
```

**Root cause**
`truffle test` defaults to the `development` network (localhost:8545). No local node was running.

**Smallest fix**
- Run `npx truffle test --network test`, or start a local node on `127.0.0.1:8545`.

## Solidity compiler warnings during `npx truffle compile`

**Reproduction**
```bash
npx truffle compile
```

**Failure**
```
Warning: This declaration has the same name as another declaration.
--> project:/contracts/test/MockENSRegistry.sol:8:37

Warning: This declaration has the same name as another declaration.
--> project:/contracts/test/MockPublicResolver.sol:8:61

Warning: Return value of low-level calls not used.
--> project:/contracts/AGIJobManager.sol:1062:9
```

**Root cause**
Warnings originate from mock contracts used in tests and the best-effort ENS hook call
that intentionally ignores the return value.

**Smallest fix**
- Optionally rename the mock function arguments to avoid name shadowing and
  document/annotate the ENS hook call to suppress the warning if desired.
