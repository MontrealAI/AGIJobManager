# Start here — v0.9.5

**This release makes buyer protection clearer and USDC payments recoverable.** It requires a fresh manager deployment; existing jobs remain on their original managers.

1. Open `agijobmanager-usdc.html` for the current console. Read the job evidence before choosing **Accept work and pay**. Acceptance is final.
2. For the source and full operator guides, open `source/docs/START_HERE.md` and `source/docs/BUYER_PROTECTION.md` in the complete archive.
3. To deploy, use `source/hardhat/README.md`. Supply and verify the actual owner, two settlement recipients, ENS configuration and NFT policy. All eight linked libraries must match the qualified artifacts. Keep intake paused until the instance checks pass.
4. Check `SHA256SUMS.txt` and `RELEASE_MANIFEST.json` before using the files. `VALIDATION.md` describes the exact source and verification scope.

Normal Agent/Club ENS membership remains required; explicit owner-managed admission exceptions retain their documented behavior. The NFT requirement still defaults to on and is fixed per job when posted.

Publishing this release does not deploy or activate it on Ethereum. Fork rehearsals preserve the recorded legacy jobs; they do not establish control of production signing keys or ENS roots.
