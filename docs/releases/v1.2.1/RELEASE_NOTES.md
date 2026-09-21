# v1.2.1 — Stronger settlement snapshot assurance

Adversarial review of v1.2.0 identified reporting checks worth strengthening. This patch makes the read-only settlement report more precise about which block, asset and RPC observations it uses. It changes no payout contract.

## Download

- [AGIJobManager-v1.2.1-COMPLETE.zip](https://github.com/MontrealAI/AGIJobManager/releases/download/v1.2.1/AGIJobManager-v1.2.1-COMPLETE.zip): extract it and open `START_HERE.md`.
- [Standalone USDC console](https://github.com/MontrealAI/AGIJobManager/releases/download/v1.2.1/agijobmanager-usdc.html).
- [SHA256SUMS.txt](https://github.com/MontrealAI/AGIJobManager/releases/download/v1.2.1/SHA256SUMS.txt) and [RELEASE_MANIFEST.json](https://github.com/MontrealAI/AGIJobManager/releases/download/v1.2.1/RELEASE_MANIFEST.json): verify downloads and frozen-source identity.

## Corrections

- **One canonical block:** every code/state read uses an EIP-1898 block-hash selector with `requireCanonical: true`. The tool fails unsupported or noncanonical reads without falling back to a block number.
- **Expected asset:** Ethereum chain 1 requires native Circle USDC and six decimals. Other chains require `--expected-token` and display `TOKEN`, avoiding an unverified USDC label.
- **Fresh RPC observations:** both configured endpoints must report heads no more than 300 seconds old or 60 seconds ahead of the local clock by default. Checks run before reading and again before output. Malformed block metadata is rejected.
- **Executable regression evidence:** two new tests failed against v1.2.0 and pass after correction. The expanded suite tests canonical selectors, unsupported reads, asset mismatch, stale/future heads and actual two-endpoint CLI success/failure, including redacted errors.

## Upgrade notes

Ethereum operators can retain the existing command arguments, but their RPC must support EIP-1898 canonical-hash reads and the host clock must be correct. Non-mainnet commands now require an explicit `--expected-token 0xADDRESS`. Use `--max-head-age SECONDS` to adjust the age limit; `0` deliberately disables freshness checks and is reported as disabled. A local simulated clock may need that override. Freshness applies to the observed RPC head, not the older confirmed snapshot block.

Existing JSON amount fields remain integer strings with six-decimal units and schema v1; additive `asset`, `stateReference` and `freshness` metadata describe the stronger checks. Exit codes remain 0 for a successful aggregate report without attention flags, 2 for a complete report with attention flags and 1 when no complete report could be produced. None is a general deployment-readiness certificate. Read `source/docs/OPERATIONS/SETTLEMENT_RECOVERY.md` and `source/docs/qualification/V121_REVIEW.md` in the complete package.

## Qualification and preserved boundaries

Frozen source: `a34f12482855c64104d3e1cd7871d35a013e4f49`, tree `de20960de19d3419da6edc5518e30d829f7b3902`; source PR [#1536](https://github.com/MontrealAI/AGIJobManager/pull/1536). Publication requires all five exact-source workflows and eight required jobs, their actual checkout logs, protected-history checks, reproducible packaging and uploaded-asset digest verification. `VALIDATION.md` records executed checks and source CI links.

All Solidity sources, ABI/bytecode inputs, eight library links, payout rules, dependency resolutions, legal notices and historical releases remain unchanged. Existing jobs and settings stay on their original managers. Software publication performs no deployment or public-chain transaction. Private AGI Agent, AGI Node and fleet implementations, credentials and private artifacts are excluded.

This is a stronger bounded reporting release, not an absolute “10/10” certification or independent security audit. RPC honesty, later reorganizations, live deployment verification, operator judgment and production capacity remain separate concerns. Zero reserve counters do not establish useful work, participant profit or inevitable future recovery.
