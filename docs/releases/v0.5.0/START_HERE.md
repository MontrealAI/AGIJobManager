# Start here — AGIJobManager v0.5.0

USDC is the sole job-settlement currency in this release: payouts, escrow, bonds, rewards, refunds and treasury withdrawals all use six decimal places.

## Download and verify

Download `AGIJobManager-v0.5.0-COMPLETE.zip` for the complete source, standalone console, migration guide and release evidence. The console is also attached separately as `agijobmanager-usdc.html`.

Place the ZIP, HTML, `RELEASE_MANIFEST.json` and `SHA256SUMS.txt` in one directory:

```bash
sha256sum -c SHA256SUMS.txt
# macOS:
shasum -a 256 -c SHA256SUMS.txt
```

All three listed files must report `OK`. The manifest records every archive payload's size and SHA-256 digest. These checks verify integrity against this GitHub release; they are not a separate cryptographic signature.

## Deployment required

This software release does not deploy or upgrade an on-chain manager. Existing immutable deployments retain their original assets and balances. Read `source/docs/USDC_MIGRATION.md` before deployment or cutover.

The console has no default manager. Configure only a newly deployed and source-verified v0.5.0 USDC manager on Ethereum mainnet. Its chain/token checks do not substitute for independent source and bytecode verification. The Next.js and operator interfaces also guard their transaction paths against wrong settlement tokens.

Open the standalone console in a wallet-compatible browser. If file URLs are unsupported, serve the extracted directory locally:

```bash
python3 -m http.server 8080 --bind 127.0.0.1
```

Open `http://127.0.0.1:8080/agijobmanager-usdc.html`. The console loads Web3 from a CDN and needs a wallet/RPC connection for chain interactions; it is not an offline chain client.

## Contents

| Path | Purpose |
| --- | --- |
| `agijobmanager-usdc.html` | Primary USDC console |
| `source/` | Exact pinned repository source |
| `source/docs/USDC_MIGRATION.md` | Breaking changes, amount units and cutover |
| `RELEASE_NOTES.md`, `VALIDATION.md` | Scope, checks and limitations |
| `CHANGES.json`, `SOURCE_CI.json`, `PREVIOUS_RELEASE.json` | Change inventory and provenance |
| `RELEASE_MANIFEST.json` | Source identity and payload digests |
| `release-tooling/` | Packaging, verification and publication scripts |

Historical receipts, legacy regression fixtures and previous release records under `source/` document earlier systems. They are not current USDC deployment instructions. ETH remains required for gas; ENS/NFT credentials are identity evidence, not payment currencies.
