# Start here — AGIJobManager v1.0.1

Verify the downloaded files against `SHA256SUMS.txt`. Open `agijobmanager-usdc.html` in a wallet-enabled browser, then choose **Buy work**, **Do work** or **Review work**. The console requires internet access and an independently verified compatible Ethereum mainnet manager; no live manager address is supplied. Never enter a seed phrase or private key.

For participant guidance, open `source/docs/START_HERE.md`. For buyer recovery, read `source/docs/BUYER_PROTECTION.md`. Inspect the work and its dispute deadline before authorizing final payment. Existing jobs remain on their original contracts.

## New ENS setup

Fresh managers now receive names shaped as:

```text
job-<jobId>.usdc-<chainId>-<full-manager-address-without-0x>.alpha.jobs.agi.eth
```

The deployment script derives the name and sets the `job-` prefix. It refuses occupied namespaces and existing job history. Read `source/docs/ENS_DEPLOYMENT_NAMESPACES.md`, then follow `source/hardhat/README.md` and the launch checklist.

For an existing manager, a software update keeps the original namespace. Use explicit replacement mode only when replacing that same manager's helper, and preserve the exact historical labels. Publishing or downloading this edition performs no ENS registration or blockchain transaction.

Read `RELEASE_NOTES.md` for scope, `VALIDATION.md` and `SOURCE_CI.json` for verification, and `RELEASE_MANIFEST.json` for the frozen source and file digests. The package includes the current console fixes, combined free name plus identity-NFT onboarding and historical Genesis simulation introduced after v1.0.0. Earlier releases remain available with their original checksums.
