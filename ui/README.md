# AGIJobManager UI

Standalone Next.js App Router UI for read-only browsing + simulation-first writes.

## Requirements
- Node.js >=20.11.0

## Commands
- `npm ci`
- `npm run dev`
- `npm run build`
- `npm run lint`
- `npm run test`
- `npm run test:e2e`

## Notes
- Dark mode is default with ASI Sovereign Purple theme tokens.
- Wallet is optional for read-only pages.
- All writes run preflight + simulateContract before send.
