# Test status and release evidence

Use the immutable release's `VALIDATION.md` and `SOURCE_CI.json` for source-specific results. Older local counts and Node versions are historical; they do not qualify the current release.

The required gates are contract CI (all four shards), UI CI, Security Verification, Docs Integrity and Mainnet USDC Fork Qualification. The release publisher checks the exact application commit, workflow paths and successful statuses before it creates the tag and publishes assets.

[Testing](TESTING.md) lists reproducible commands; [mainnet readiness](MAINNET_READINESS.md) explains what those checks establish and what remains instance-specific. [Known limitations](KNOWN_ISSUES.md) and [dependency security](DEPENDENCY_SECURITY.md) record residual issues without treating a passing test suite as a vulnerability-free certification.

Use Node 22.23.2, committed lockfiles and the compiler/tool versions pinned by CI. Testnet and local-fork results are not a live deployment or a production signing rehearsal.
