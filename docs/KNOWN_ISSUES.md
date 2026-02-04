# Known issues

This file tracks reproducible failures in local commands or tests.

## `npx truffle test` fails without a local JSON‑RPC node

**Reproduction**
```bash
npx truffle test
```

**Failure**
```
CONNECTION ERROR: Couldn't connect to node http://127.0.0.1:8545.
```

**Root cause**
`truffle test` defaults to the `development` network, which expects a local
node at `127.0.0.1:8545`. The container does not run Ganache by default.

**Smallest fix**
- Start Ganache locally: `npx ganache -p 8545`, **or**
- Use the in‑process provider: `npx truffle test --network test`.
