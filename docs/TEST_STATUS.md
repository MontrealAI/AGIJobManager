# Test Status

## Failing command
- `npx truffle test`

## Error output
```
> Something went wrong while attempting to connect to the network at http://127.0.0.1:8545. Check your network configuration.
CONNECTION ERROR: Couldn't connect to node http://127.0.0.1:8545.
Truffle v5.11.5 (core: 5.11.5)
Node v20.19.6
```

## Root cause
`truffle test` defaults to the `development` network (localhost:8545). No Ganache node was running at that address in this environment.

## Passing command
- `npx truffle test --network test` (`226 passing`)

## Smallest fix required
Either:
1. Run a local node: `npx ganache -p 8545`, then re-run `npx truffle test`, **or**
2. Use the in-process provider: `npx truffle test --network test`.
