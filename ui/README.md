# AGIJobManager UI

Next.js App Router dapp + ops console for AGIJobManager.

## Setup

```bash
cp .env.example .env.local
npm ci
npm run dev
```

## Scripts

```bash
npm run build
npm run lint
npm run test
npm run test:e2e
```

## Notes

- Read-only mode works without a wallet.
- Transactions are simulation-first (`simulateContract` before writes).
- URI rendering is scheme-allowlisted (`https://`, `http://`, `ipfs://`, `ens://`).
- Dark/light ASI Sovereign Purple theme, with dark default and toggle.
