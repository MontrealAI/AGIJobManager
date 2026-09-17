# AGIJobManager v0.7.0

Open `agijobmanager-usdc.html` for the USDC console. Transactions remain disabled until a verified v0.7.0 manager is configured. Full source is under `source/`.

At defaults, a successful 100 USDC job pays validators 8 USDC, wallet one 30 USDC, wallet two 10 USDC, and the agent 52 USDC. Read `source/docs/USDC_PAYOUT_SPLIT.md` for rate snapshots, rounding, no-vote completion, refunds and bonds.

The owner can update recipients only with intake paused and all escrow settled. A proposed owner must accept ownership. Read `source/docs/OWNER_CONTROLS.md` before operating these controls.

1. Read `RELEASE_NOTES.md`, `VALIDATION.md`, `source/docs/USDC_MIGRATION.md` and `source/docs/DEPENDENCY_SECURITY.md`.
2. Verify downloads with `sha256sum -c SHA256SUMS.txt` (or `shasum -a 256 -c SHA256SUMS.txt` on macOS).
3. Inspect source commit `897b3ebc30c0c9b3c087160ade5beb399a8e390a` (tree `a91fb684053e40259a4c3e215a73402abdf419ca`) and the per-file inventory in `RELEASE_MANIFEST.json`.
4. For a separately authorized deployment, use Node 22.23.2 and the locked dependencies in `source/hardhat/`; supply both real recipients, complete ownership acceptance and verify configuration before opening intake.

This download does not deploy a contract or move funds. Ethereum mainnet settlement uses Circle USDC, `0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48`, six decimals. ETH pays gas.

Historical receipts and previous releases are preserved as provenance, not current deployment instructions. The annotated application tag points to the tested source commit. Publication metadata and tooling are included separately in this complete package.
