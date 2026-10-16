# Release validation and provenance

## Candidate scope and pending qualification

v1.17.2 is a software candidate based on merged main source `d01c40121752f09660f8083c6c2a967acbf714ab` (tree `a4b40aae3f384661f341eb4749fefdd3adcfee01`). All seven qualification workflows must pass on its exact final main source. Earlier PR #1579 checks and the separate internal optional-router review (585 preflight cases and 23 additional probes) concern their recorded source; they do not qualify these release-metadata changes. The reported 4,212-byte router runtime is source-compiled evidence, not deployed-address verification.

The root, Hardhat and UI version labels change only from 1.17.1 to 1.17.2. Dependency resolutions, all Solidity and compiler settings remain unchanged. `config/next-deployment-contract-changes.json` retains the historical baseline and declares exact current package hashes. The executed v1.17.1 cutover report is preserved byte for byte in `docs/qualification/history/mainnet-cutover-v1.17.1.json`. The current `mainnet-cutover-next-deployment.json` updates only its four package hashes and remains an expected comparison fixture until a fresh fork execution matches it. Historical outcomes and block identity are unchanged; no fresh fork execution is implied by this source-binding update.

The v1.17.1 Slither review remains untouched. The separate v1.17.2 review updates only the root-lockfile hash and retains every finding disposition. Its pending status is explicit. Final-source Security Verification must actually rerun all three scanners and compare exact source hashes and finding identities; copied historical findings are not new scan results or an independent audit.

## Local preparation checks — 15 October 2026

With Node 22.23.2, the candidate passed 585 preflight cases, 60 offline release-gate cases (normal and optimized Python), dependency/source-boundary checks, 11 Slither-verifier adversarial cases, documentation/ENS/UI-documentation checks, 38 Builder cases, three preservation cases and 35 mocked console checks. The UI artifact was built twice from clean Next.js state and compared byte for byte. Pages build/inventory checks and English/French browser journeys passed with the available Chromium 139.0.7258.5 executable; the initially requested Playwright-managed executable was absent, so that fallback is recorded explicitly. The hosted pinned-browser lane remains required. These are focused local preparation results, not final-main qualification or live-chain evidence.

An exact-byte comparison preserved 302 existing release/history/static-review records, all Solidity/compiler/deployment source, and all six package dependency graphs. Only software version labels changed in those package files. The fork expected fixture changes four package hashes; its other 72 hashes and all historical outcomes remain identical. The new static-review binding changes only the root-lockfile hash; all 163 retained finding dispositions remain identical across the three report inventories.

The top-level archive guide copies rebase their relative links to included source documents while source copies remain unchanged. Six focused cases cover parent paths, sibling guides, external links, fragments/queries, missing/escaping targets and the complete current four-guide set.

## Release gates

Candidate assets must be built twice and compared, then extracted and rebuilt without network dependencies. Contract regressions, native historical-runtime reconstruction, pinned USDC/ENS fork tests, Foundry fuzz/invariants, source-bound static-analysis review, UI and documentation gates all remain required. Local focused checks do not replace these workflows. `QUALIFICATION.json` must bind completed exact-final-source runs and the immutable candidate artifact; no qualification receipt is created by this preparation.

Download all nine published assets into one directory. Use a trusted checkout of the reviewed release source to verify every asset's assembly attestation, then checksums and the published inventory:

```bash
gh attestation verify My-SUCCESSOR-Omega-en.html --repo MontrealAI/AGIJobManager --signer-workflow MontrealAI/AGIJobManager/.github/workflows/publish-v114.yml --signer-digest EXACT_RELEASE_COMMIT --source-digest EXACT_RELEASE_COMMIT --source-ref refs/heads/main --deny-self-hosted-runners
sha256sum -c SHA256SUMS.txt
python3 scripts/release/verify-package.py PATH_TO_DOWNLOADED_ASSETS --published
```

Repeat attestation verification for every asset. Attestation lookup needs network access; the package verifier is offline. Without `--published`, it accepts only the eight-file candidate inventory. Published mode requires `QUALIFICATION.json`; never remove it or edit checksums to make a download pass. Publication must report `immutable: true` and repository/workflow/source-bound attestations.

After separately authorized Pages publication, compare `build-info.json` and every `files` entry against the same reviewed SHA. `.nojekyll` is a local build marker under `buildOnlyFiles`; the uploader excludes it from public deployment. Preserve the immutable v1.17.1 release and all A1–A5 activation records. Actual-address router verification, owner configuration, current-chain readiness and live operation remain separate and unestablished here.
