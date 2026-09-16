# Start here — AGIJobManager v0.4.0

This is the final snapshot of the current development phase, released September 16, 2026. Source commit: `5d3607e98672487ec67f856079c154d340c3e848`; source tree: `2fe8911c0a1e857db5a2caebae9cf8fcd9b2a44f`.

## Contents

| Location inside the COMPLETE archive | Purpose |
| --- | --- |
| `agijobmanager_genesis_job_mainnet_2026-03-05-v33.html` | Primary Genesis Console, unchanged from the source commit |
| `source/` | Complete tracked source snapshot, including all historical consoles and deployment records |
| `LICENSE` | MIT license; the original is also under `source/` |
| `RELEASE_NOTES.md`, `VALIDATION.md` | Changes, validation evidence and qualification limits |
| `RELEASE_MANIFEST.json` | Source identity, payload file sizes and SHA-256 digests |
| `CHANGES.json` | Exact 46-path change inventory since the previous release |
| `SOURCE_CI.json`, `PREVIOUS_RELEASE.json` | Captured CI metadata and prior published release provenance |
| `release-tooling/` | Packaging, verification, publication scripts and workflow |

## Verify the download

Place all four attached release assets in one directory before running:

```bash
sha256sum -c SHA256SUMS.txt
# macOS alternative:
shasum -a 256 -c SHA256SUMS.txt
```

Each of the three listed assets must report `OK`. The manifest lists every payload file except itself; the external checksum file covers the manifest and the complete ZIP. Download checksums from the same GitHub release. Checksums establish integrity against that release, not a separate cryptographic signer.

## Open the console

Open the top-level v33 HTML file in a browser compatible with your Ethereum wallet. If the wallet does not support file URLs, serve the extracted archive locally:

```bash
python3 -m http.server 8080 --bind 127.0.0.1
```

Then open `http://127.0.0.1:8080/agijobmanager_genesis_job_mainnet_2026-03-05-v33.html`. The HTML fetches Web3 from a CDN and needs live wallet/RPC connectivity. Review the chain, account, resolved manager/ENS addresses and transaction details before signing. Read the deployment context and known boundaries in `RELEASE_NOTES.md`.

## Develop from the baseline

The annotated `v0.4.0` tag resolves to the pinned application commit. Clone the repository and check out that tag, or inspect `source/` in this archive. Use the checked-in lockfiles and Node 20 for the established root CI commands. The canonical deployment workspace remains `source/hardhat/`; release publication does not execute its deployment scripts.

The archive's release tooling is supplemental to the source snapshot. To rebuild release assets, use a repository checkout containing the release-preparation commit on `main`, with full history and tags, and run:

```bash
node scripts/release/verify-genesis-ui.mjs .
python3 scripts/release/package-release.py --out /tmp/agijobmanager-release-rebuild
```

Use an empty output directory. The packager always reads the configured source commit from Git, checks its tree and diff inventory, and preserves all original source bytes. The workflow also verifies a second identical build in the same environment. To reproduce a previously published package, use the exact release-preparation revision referenced by the publication workflow, not a later revision of `main`.

Retain the previous release and this release for comparison. Returning to an older source or UI version does not roll back on-chain state.
