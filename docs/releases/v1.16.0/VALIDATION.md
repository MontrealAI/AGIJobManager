# Candidate validation and provenance

This file describes the required process, not a pre-signed passing result. `RELEASE_MANIFEST.json` binds source commit/tree and every archived file. `QUALIFICATION.json` is produced only from completed successful exact-main-source workflow runs and a matching immutable candidate artifact. All six prior workflows and GitHub Pages build/check evidence are mandatory; qualification does not deploy Pages.

The candidate is built twice from archived source and compared byte for byte. Clean extraction checks the complete inventory, rebuilds both Builder editions/source ZIP, and runs the exported local journey tests plus existing release/console tests. The full acceptance matrix and external human/provider gates are in `source/docs/successor/ACCEPTANCE.md`.

During separately authorized publication, the pinned `actions/attest` step signs the release assembly. Verification binds the artifact digest, `MontrealAI/AGIJobManager`, `.github/workflows/publish-v114.yml`, exact source/signer commit and `refs/heads/main`. This attests the selected qualified assembly, not correctness, independent review or production readiness. After downloading release assets:

```bash
sha256sum -c SHA256SUMS.txt
python3 source/scripts/release/verify-package.py PATH_TO_DOWNLOADED_ASSETS
gh attestation verify My-SUCCESSOR-Omega-en.html --repo MontrealAI/AGIJobManager --signer-workflow MontrealAI/AGIJobManager/.github/workflows/publish-v114.yml --signer-digest EXACT_RELEASE_COMMIT --source-digest EXACT_RELEASE_COMMIT --source-ref refs/heads/main --deny-self-hosted-runners
```

Verify all assets in the same way. Replace `EXACT_RELEASE_COMMIT` using the reviewed manifest and qualification. Attestation lookup needs network access; the local engine/rebuild does not. Inspect actual release metadata before claiming GitHub-enforced immutability. Prior v1.15.0 was observed with `immutable: false`; this change does not alter repository settings.

After Pages dispatch, independently fetch EN/FR routes and downloads and compare `build-info.json.sourceCommit`, source manifest and published file digests with the qualified deployment SHA. Until that succeeds, website publication is unverified. Software publication never activates A1–A5 paid intake.
