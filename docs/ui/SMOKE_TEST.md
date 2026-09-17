# AGIJobManager UI smoke test (local)

The automated smoke test exercises the static UI against a disposable Hardhat 3 chain. The runner starts the chain, deploys and funds its local fixture, serves the UI, injects the test wallet provider, and shuts everything down afterward. Truffle, Ganache and manually supplied signing keys are not used.

## Install and build

From the repository root:

```bash
npm ci
npm --prefix hardhat ci
npm run build
```

Install the Playwright browser separately before the first browser run:

```bash
npx playwright install chromium
```

On a Linux CI host that also needs browser system libraries, use `npx playwright install --with-deps chromium` during environment setup.

## Run the smoke test

```bash
npm run test:ui
```

The command first runs the local indexer checks, then the Playwright scenario in `ui-tests/ui-smoke.spec.js`. It creates its own manager address and RPC endpoint; old `build/contracts` network addresses and retired migration commands are not inputs.

## What the browser scenario checks

1. The contract ABI loads and the injected local wallet connects.
2. Refreshing the snapshot returns owner and USDC-token data.
3. The employer approves 10 mock USDC and receives a confirmed transaction result.
4. The employer creates a job with a 1 USDC payout, a 3,600-second duration and an existing job specification URI.
5. The job appears in the UI list, with no unexpected browser errors or dialogs.

This smoke test covers the local static UI transaction flow. The standalone USDC console and the Next.js application have additional checks described in [Testing](../TESTING.md); this test alone is not a mainnet readiness review.

## Common failures

- **Browser executable missing:** complete the separate Playwright installation step above.
- **Port already in use:** stop the process using port 4173 or choose an available port with `AGIJOBMANAGER_UI_PORT=4174 npm run test:ui`.
- **Missing or stale artifacts:** run `npm run build`, then `npm run ui:abi:check`. Regenerate the UI ABI with `npm run ui:abi` when a reviewed contract change requires it.
- **Fixture or transaction failure:** inspect the runner output and the browser activity-log assertion. The fixture is recreated on each run; do not substitute a live manager or funded wallet.
