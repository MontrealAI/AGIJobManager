# v1.6.1 — Aligned deployment and operator guides

Some active guides still carried older edition headings and download links, and the deployment registry was labeled 1.5.0 in the 1.6.0 software package. These inconsistencies made it harder to choose matching instructions and distinguish historical evidence from the current release.

## Changes

- Align root, Hardhat, UI, lockfile and deployment-registry versions; refresh generated interfaces and current download links.
- Replace obsolete active guide headings and correct the release history, while preserving dated release, legal, security and qualification records.
- Generate a central release guide with 16 real Hardhat commands, explicit read-only deployment plans, configuration paths and verification/readiness requirements.
- Check release identities, active guide headings, current downloads, command entrypoints, console title and generated-guide freshness in documentation CI.
- Make the deployment sequence explicit: finish paused readiness, complete owner activation, then run the limited canary. Separate contract readiness from employer pre-funding qualification and private-fleet commissioning.

Solidity, payout rules, Hardhat deployment implementations, admission implementations and dependency resolutions are unchanged. Existing compatible managers do not need redeployment for this patch.

## Validation

All five exact-source workflows and eight required jobs passed. The contract/tool shards passed 620 cases; deployment verification passed 107 preflight/recovery and 10 local-deployment cases. Qualification also includes 23 native-USDC fork cases, actual browser/UI checks, dependency audits, Foundry fuzz/invariants and reviewed Slither findings. Documentation checks cover 190 active guides and 16 commands; eight deliberate local drift probes were rejected as expected.

The publication workflow re-verifies each job's actual source checkout, runs 35 release-gate regressions and 35 standalone-console checks, and requires two byte-identical builds. Published asset sizes and digests must match before the draft becomes public. Complete evidence and per-file checksums are included.

## Scope

This is a documentation and metadata patch to commissioning software. It does not establish production throughput, real model economics, employer value, issuer/reviewer independence or performance of physical Macs. No live contract deployment, public-chain transaction, new million-offer simulation or independent security audit was performed for this patch. Private software is distributed separately.
