# Release validation and provenance

All seven qualification workflows must pass on the exact final main source. `QUALIFICATION.json` binds those completed runs and the immutable candidate artifact. Candidate assets are built twice and compared, then extracted and rebuilt without network dependencies. The publication workflow also verifies the complete nine-file published inventory before signing it.

Download all nine assets into one directory. Confirm their provenance before executing downloaded source. Use a trusted checkout of this release's source for the verifier. After establishing the reviewed release commit, verify each asset's assembly attestation:

```bash
gh attestation verify My-SUCCESSOR-Omega-en.html --repo MontrealAI/AGIJobManager --signer-workflow MontrealAI/AGIJobManager/.github/workflows/publish-v114.yml --signer-digest EXACT_RELEASE_COMMIT --source-digest EXACT_RELEASE_COMMIT --source-ref refs/heads/main --deny-self-hosted-runners
sha256sum -c SHA256SUMS.txt
python3 scripts/release/verify-package.py PATH_TO_DOWNLOADED_ASSETS --published
```

Repeat attestation verification for every asset. Attestation lookup requires network access. The package verifier is offline: it checks recorded qualification bindings and exact bytes, not current GitHub workflow status, authorship or independent qualification. Without `--published`, it intentionally accepts only the eight-file candidate inventory. Published mode requires `QUALIFICATION.json`; never remove it or edit checksums to make a download pass.

The offline verifier checks the entire archive inventory and total uncompressed size before reading entries, verifies file identities, reconstructs the Builder assets byte for byte and runs the portable journey, console and release tests. Contract regressions, native historical-runtime reconstruction, the pinned USDC/ENS fork, Foundry fuzz/invariants and source-bound static-analysis review must all execute on the final candidate. Prior-source success is not transferable. External independent security review and real user sessions are not established by these workflows.

Publishing must produce `immutable: true` release metadata and repository/workflow/source-bound attestations. After separately authorized Pages publication, compare every public file and `build-info.json` against a build of the same reviewed SHA. Preserve historical releases and all A1–A5 activation records.

## Refreshed candidate evidence — 15 October 2026

PR #1577 source `c1cf9222fe4f1e4def15d3c540a8d90873ada4f6` actually executed the 11 native-USDC cases and 23 legacy/ENS cutover cases in [run 38796314074](https://github.com/MontrealAI/AGIJobManager/actions/runs/38796314074). The enclosing run failed because the committed source hashes were stale. The downloaded cutover artifact `12002970443`, ZIP SHA-256 `993bcd4dadd6844a1155b1ebc9308c008b81f25882866c92067a6ee10080fadd`, supplies the next-deployment receipt; outcomes and fork block remain unchanged. This records a fresh execution, not a relabelled historical receipt or current live-chain approval.

[Security run 38796314107](https://github.com/MontrealAI/AGIJobManager/actions/runs/38796314107) executed all three Slither 0.11.6 scans, then failed the old root-lockfile binding. Downloaded artifact `12002761056`, ZIP SHA-256 `5b2c2c8dd42eea352661837e9decccab3448f326c512e2741ee85fbb06e0dfc6`, contains 12 medium/high, 29 reentrancy and 122 all-detector findings. Every identity, detector, impact and confidence matches the previously individually reviewed dispositions. The new versioned review preserves the historical review and records the version-label-only lockfile delta.

The console preservation normalizer explicitly recognizes 1.17.1 and the exact embedded documentation correction explaining that the ENS library changes bytecode. Executable console and ABI bytes remain compared. These corrections require fresh final-head hosted checks; neither failed run is declared passed.
