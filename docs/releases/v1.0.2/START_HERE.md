# Start here — AGIJobManager v1.0.2

Verify the downloaded assets against `SHA256SUMS.txt`. The complete archive contains the console, source, current guides and release evidence. `RELEASE_MANIFEST.json` records the pinned source and every packaged file's digest.

## Deploying the software

Open a terminal in the extracted `source/` directory. Use Node 22.23.2, then run:

```bash
npm ci
npm --prefix hardhat ci
npm --prefix hardhat run setup
```

Setup preserves existing files. Review the files it creates inside `hardhat/`: `.env`, `deploy.config.cjs` and `reviewed-nft-policy.json`. Fill the intended owner, both payment recipients and selected network configuration. Choose the NFT policy explicitly; the empty required registry is not ready for launch.

Continue with `source/hardhat/README.md` and `source/docs/DEPLOYMENT_CONFIGURATION.md`. The offline profile check comes before the live read-only plan. Broadcasting, accepting ownership, configuring optional ENS and opening intake are separate steps with their own checks.

When upgrading an operator checkout, Hardhat now consistently reads `hardhat/.env`; exported shell settings win. Move any Hardhat-only settings previously kept in the root `.env`. Never place a private key in a configuration file intended for sharing.

## Using the console

Open `agijobmanager-usdc.html` in a wallet-enabled browser and choose **Buy work**, **Do work** or **Review work**. It needs internet access and an independently verified compatible Ethereum mainnet manager. No live manager is configured by this release. Never enter a seed phrase or private key into the console.

Read `source/docs/START_HERE.md` for the participant journey and `source/docs/BUYER_PROTECTION.md` for missing or poor work. Existing jobs remain on their original manager, token and namespace. A verified v0.9.6-compatible manager does not need redeployment for this patch.

The deployment-specific ENS pattern remains `job-<jobId>.usdc-<chainId>-<manager40>.alpha.jobs.agi.eth`. The full lowercase manager address excludes `0x`; same-manager replacements preserve their existing names. Publication and downloading do not register names or broadcast transactions.

Read `RELEASE_NOTES.md` for changes and `VALIDATION.md` plus `SOURCE_CI.json` for qualification. Earlier editions remain available with their original checksums.
