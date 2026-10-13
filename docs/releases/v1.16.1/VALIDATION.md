# Patch validation and provenance

All seven qualification workflows must pass on the exact final main source. `QUALIFICATION.json` binds those completed runs and the immutable candidate artifact. Candidate assets are built twice and compared, then extracted and rebuilt without network dependencies. The publication workflow also verifies the complete nine-file published inventory before signing it.

Download all nine assets into one directory. Confirm their provenance before executing downloaded source. Use a trusted checkout of this release's source for the verifier. After establishing the reviewed release commit, verify each asset's assembly attestation:

```bash
gh attestation verify My-SUCCESSOR-Omega-en.html --repo MontrealAI/AGIJobManager --signer-workflow MontrealAI/AGIJobManager/.github/workflows/publish-v114.yml --signer-digest EXACT_RELEASE_COMMIT --source-digest EXACT_RELEASE_COMMIT --source-ref refs/heads/main --deny-self-hosted-runners
sha256sum -c SHA256SUMS.txt
python3 scripts/release/verify-package.py PATH_TO_DOWNLOADED_ASSETS --published
```

Repeat attestation verification for every asset. Attestation lookup requires network access. The package verifier is offline: it checks recorded qualification bindings and exact bytes, not current GitHub workflow status, authorship or independent qualification. Without `--published`, it intentionally accepts only the eight-file candidate inventory. Published mode requires `QUALIFICATION.json`; never remove it or edit checksums to make a download pass.

The offline verifier checks the entire archive inventory and total uncompressed size before reading entries, verifies file identities, reconstructs the Builder assets byte for byte and runs the portable journey, console and release tests. The new browser regressions cover rejected replacement imports, pending worker controls, Stop, late responses, chosen-version rollback and retained larger-text settings in both languages. Existing browser and accessibility checks continue to run; human sessions are not claimed.

Publishing must produce `immutable: true` release metadata and repository/workflow/source-bound attestations. After separately authorized Pages publication, compare every public file and `build-info.json` against a build of the same reviewed SHA. Preserve historical releases and all A1–A5 activation records.
