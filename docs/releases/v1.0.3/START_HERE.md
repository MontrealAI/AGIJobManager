# Start here — AGIJobManager v1.0.3

Verify the downloaded assets against `SHA256SUMS.txt`. The complete archive contains the console, source, current guides and release evidence. `RELEASE_MANIFEST.json` records the frozen source and each packaged file's digest.

## Prepare a fresh deployment

Open a terminal in the extracted `source/` directory. Use Node 22.23.2, then run:

```bash
npm ci
npm --prefix hardhat ci
npm --prefix hardhat run setup
```

Review the files inside `hardhat/`: `.env`, `deploy.config.cjs` and `reviewed-nft-policy.json`. Fill the intended owner, both payment recipients and selected network configuration. Setup preserves existing files and never overwrites an earlier reviewed policy.

Fresh v1.0.3 managers start with NFT admission disabled and no registered collections. The generated policy matches that state: `agentNftRequired: false`, `agiTypes: []`. Keeping this policy needs no NFT-setting transaction. To opt in, follow `source/docs/NFT_POLICY.md` to register reviewed collections and enable the requirement before posting affected jobs.

Continue with `source/hardhat/README.md` and `source/docs/DEPLOYMENT_CONFIGURATION.md`. Run the offline configuration check, then the read-only deployment plan. Broadcasting, accepting ownership, configuring optional ENS, checking readiness and opening intake are separate steps. Intake starts paused.

Hardhat reads `hardhat/.env`; exported shell settings win. Keep private keys out of shared files. Owner controls must use the accepted owner's signing setup.

## Existing managers and jobs

An existing compatible manager retains its current NFT default. Its accepted owner can call `setAgentNftRequired(false)` for future postings without redeployment. Existing jobs retain their recorded requirements. Read the actual manager and job getters; a matching ABI or runtime does not prove the disabled setting.

Open `agijobmanager-usdc.html` in a wallet-enabled browser and choose **Buy work**, **Do work** or **Review work**. It needs internet access and a verified compatible Ethereum mainnet manager. No live manager is configured by this release. Never enter a seed phrase or private key into the console.

Read `source/docs/START_HERE.md` for the participant journey and `source/docs/BUYER_PROTECTION.md` for missing or poor work. Disabling NFT admission does not waive authorization or bonds, alter payouts or disable employer completion NFTs. Existing jobs remain on their original manager, asset and ENS namespace.

Fresh deployment ENS names retain `job-<jobId>.usdc-<chainId>-<manager40>.alpha.jobs.agi.eth`, with the full lowercase manager address excluding `0x`. Same-manager helper replacements preserve their existing names. Downloading and publication do not register names or broadcast transactions.

Read `RELEASE_NOTES.md` for changes and `VALIDATION.md` plus `SOURCE_CI.json` for qualification. Earlier editions remain available with their original checksums.
