# v0.4.0 — Genesis Console · Current-State Final Release

This release closes the current AGIJobManager development phase and establishes a reproducible baseline for the next phase. It preserves application commit `5d3607e98672487ec67f856079c154d340c3e848` exactly, including the v33 Genesis Console and all checked-in source, documentation, deployment records and historical console versions.

## Downloads

- **AGIJobManager-v0.4.0-COMPLETE.zip** — recommended: the full pinned source tree, ready-to-open v33 console, license, release guide, validation notes, change inventory and release tooling.
- **agijobmanager_genesis_job_mainnet_2026-03-05-v33.html** — the exact standalone console from the pinned commit.
- **RELEASE_MANIFEST.json** — source identity and SHA-256 digest/size of every payload file.
- **SHA256SUMS.txt** — checksums for the three assets above.

GitHub's automatic source archives contain the tagged application snapshot. The COMPLETE archive additionally includes the release documentation, evidence and packaging tools.

## Changes since v0.3.0-mainnet-ensjobpages-upgrade

- Genesis Console iterations v16–v33, including improved session recovery, wallet-context reset, mobile presentation, ENS identity flows, bond calculation traces, fresh-state comparison and transaction review.
- Updated operator, owner, deployment, ENS and job-lifecycle guidance, with v33 documented as the primary console.
- OpenClaw use-case materials and the AGI workforce operational blueprint.
- Website routing updates and an optional AEP-002 page-generation workflow. Its referenced `docs/standards/AEP-002/` inputs are absent from this snapshot; no complete AEP-002 evidence package is represented as delivered.

There are 46 changed paths; `CHANGES.json` records the exact inventory. Smart-contract source, protocol test suites, deployment scripts/records and the Next.js application source/dependency locks are unchanged from the previous release. Private package versions are preserved; `v0.4.0` identifies this repository release, not a new npm publication.

## Validation and provenance

- The pinned source passed [CI](https://github.com/MontrealAI/AGIJobManager/actions/runs/27019923649), [Docs Integrity](https://github.com/MontrealAI/AGIJobManager/actions/runs/27019923862) and [Security Verification](https://github.com/MontrealAI/AGIJobManager/actions/runs/27019923829) on June 5, 2026. These are historical checks of the exact source commit.
- Release preparation is gated on fresh CI, documentation, security and release-workflow checks. The release workflow exercises v33's inline-script parsing, bond arithmetic, snapshot mismatch handling and no-account session reset using mocked dependencies.
- The release workflow builds the archive twice and compares the outputs. It checks the source tree, prior-release diff, evidence digests and every packaged file before upload, then compares GitHub asset digests before publishing.
- An annotated Git tag pins the original application commit. Release preparation adds documentation and automation on `main`; it does not alter the tagged application.

## Deployment context and known boundaries

| Reference | Address | Evidence |
| --- | --- | --- |
| AGIJobManager mainnet core | `0xB3AAeb69b630f0299791679c063d68d6687481d1` | Checked-in core receipt and v33 constant |
| Replacement ENSJobPages | `0x06188E77C1C38d392b16d9D9fb24673363ce1da0` | Published v0.3.0 release and v33 fallback |
| Superseded ENSJobPages | `0xc19A84D10ed28c2642EfDA532eC7f3dD88E5ed94` | Historical checked-in ENS receipt |

No contracts are deployed, upgraded or reconfigured by this release. These references do not certify current on-chain ownership, parameters, permissions or liveness. The historical ENS receipt remains intact and must not be confused with the replacement described in the prior release; `PREVIOUS_RELEASE.json` captures that published provenance.

The console requires online scripts, an Ethereum wallet/provider and live RPC reads. Wallet signing, mainnet transactions, bridge/vault integrations, and external service availability are not qualified by the mocked release checks. Existing configured test and Slither exclusions remain in effect; this release is not an independent security audit.

README and UI documentation retain different hosted console URLs (the owner-site root and the repository Pages path). Use the attached, checksummed v33 file for this release. No Pages deployment or AEP-002 workflow is triggered by release preparation.

## Use and verify

Download the COMPLETE archive, console and manifest alongside `SHA256SUMS.txt`, then run `sha256sum -c SHA256SUMS.txt` (or `shasum -a 256 -c SHA256SUMS.txt`). Extract the archive and read `START_HERE.md` and `VALIDATION.md` before using the console. The full source and its MIT license are included.

Future changes should use a new release tag. Preserve this tag and its attached assets as the baseline.
