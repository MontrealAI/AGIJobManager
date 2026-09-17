# AGIJobManager v0.6.0

Open `agijobmanager-usdc.html` for the USDC console. Transactions stay disabled until a verified v0.6.0 manager is configured. The full source is under `source/`.

A successful 100 USDC job pays validators 8 USDC by default, wallet one 30 USDC, wallet two 10 USDC, and the agent 52 USDC. The wallet shares are fixed; the validator rate is frozen for each job at posting. See `source/docs/USDC_PAYOUT_SPLIT.md` for no-vote, refund, bond and rounding behavior.

Both recipient addresses must be supplied before a fresh contract deployment. This download neither deploys a contract nor moves live funds. Existing deployments are unchanged.

1. Read `RELEASE_NOTES.md`, then the payout specification and `source/docs/USDC_MIGRATION.md`.
2. Inspect the source and validation evidence at commit `529cbb028ad7ac973d33926d96479f94c6ba842f` (tree `799d338c35bbbee1c82f18fae5e4ffd842ad0e38`).
3. Verify downloads with `sha256sum -c SHA256SUMS.txt` (or `shasum -a 256 -c SHA256SUMS.txt` on macOS).
4. Review the complete payload inventory in `RELEASE_MANIFEST.json`.

Canonical production token: Circle USDC on Ethereum mainnet, `0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48`, six decimals. ETH pays network gas.

The package preserves previous release evidence and historical receipts as provenance. They are not v0.6.0 deployment instructions. The application tag points to the tested source commit; publication metadata and tooling are included separately in this complete package.
