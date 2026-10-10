# AGIJobManager v1.14.0

For an existing deployment, open [RECOVERY_GUIDE.md](RECOVERY_GUIDE.md). Preserve the original build-info, artifacts, receipts and reviewed private configuration. Do not redeploy to repair verification.

The package contains `source/` with the complete supported repository, the standalone USDC console, release notes and recovery instructions. Start commands from `source/`. Use Node 22.23.2 and the checked-in lockfiles in an isolated development checkout. Read the source README and Hardhat guide before any operator use.

A candidate Actions artifact is unqualified until all six final-source workflows pass. A published release supplies external `QUALIFICATION.json`, `RELEASE_MANIFEST.json` and `SHA256SUMS.txt`. Check the tag target, qualification source commit/tree and all asset checksums. No file exceeds 450,000,000 bytes.

For an offline package smoke check, run `python3 source/scripts/release/verify-package.py /path/to/candidate-assets` from the extracted directory (Python 3 and Node required). This checks the complete archive inventory, syntax and mocked console/release behavior. It does not replace native, fork, browser or security qualification.

The historical readiness observation reported paused intake at block 26161848. This package does not establish current mainnet state. Run the standard read-only readiness command with the original preserved deployment build to obtain a fresh limited technical report. Publishing this software does not authorize activation.
