# v1.19.1 validation and source identities

## Current status

This document records release preparation, not a qualification receipt or completed publication.

- Previous stable immutable release: [v1.19.0](https://github.com/MontrealAI/AGIJobManager/releases/tag/v1.19.0).
- Previous release source: `7438cd746dd201fdaa3c6fe4555d11a77b43d2b7`, tree `4bfb78e8a03447e0adccb9da14dd2cde84dba721`.
- Immutable integrated baseline: `8815ed3181778664595f951befd672afbd7a9352`.
- Integrated source tree: `913e49d65263bc53026916f7fc3b4cbfb93549f8`.
- Final v1.19.1 release-wrapper commit/tree: pending. No final SHA is claimed here.
- Final-wrapper qualification, release publication and uploaded-asset verification: pending.

Required workflows are CI, UI CI, Docs Integrity, Security Verification, Mainnet USDC Fork Qualification, Release Candidate Preparation, GitHub Pages and Alpha project handoff. All eight must pass on the exact final main source. Every required job, step, checkout marker and retained candidate artifact must bind that source. Missing, stale, skipped, failed or incomplete required evidence blocks publication. The published v1.19.0 release's qualification, earlier source results and historical executed reports cannot be promoted to v1.19.1 evidence.

Build candidate assets twice and compare their bytes, then verify complete inventories, clean extraction and offline rebuilding. Final `QUALIFICATION.json` must bind all completed exact-source runs and the immutable candidate artifact. Package construction or a version label alone does not supply that evidence.

## Identity boundaries

Root, Hardhat, UI and deployment-registry software labels advance together to 1.19.1. The patch clarifies the generated release guide's current-version, matching availability and previous-release references. Solidity, compiler behavior, dependency resolutions, deployment scripts and executable runtime remain unchanged; default manager, owner and settlement addresses remain blank. Historical releases, deployment journals, scanner dispositions and fork observations retain their original bytes and scope. New comparison inputs update only the applicable software-version hashes and preserve the existing observations and dispositions; exact-final-source execution remains mandatory.

Builder identity remains commit `ab516fbd32fd7cf1a9620fd630947fee1455fca2`, tree `b011643b56115c5baa39ca796cbf0a944c152eda`, version 1.17.2. The selector, retained selected package and complete source closure must match the standalone English/French HTML, editable ZIP and retained context. The release manifest separately identifies the final wrapper.

The reported mainnet snapshot is summarized in [Start here](START_HERE.md). Explorer verification, including its six Exact/three Similar distinction, is separate from release qualification. This preparation performed no new on-chain verification, configuration, deployment or activation and establishes no live paid-work qualification.

## Verify a published package

After publication, download all nine assets from the immutable v1.19.1 release:

1. `AGIJobManager-v1.19.1-COMPLETE.zip`
2. `agijobmanager-usdc.html`
3. `My-SUCCESSOR-Omega-en.html`
4. `My-SUCCESSOR-Omega-fr.html`
5. `SUCCESSOR-Omega-editable-source.zip`
6. `SOURCE_MANIFEST.json`
7. `RELEASE_MANIFEST.json`
8. `QUALIFICATION.json`
9. `SHA256SUMS.txt`

Use a trusted checkout of the reviewed release source. Replace `EXACT_RELEASE_COMMIT` with its verified full commit, never the previous release or integrated source merely because it passed checks:

```bash
gh attestation verify My-SUCCESSOR-Omega-en.html --repo MontrealAI/AGIJobManager --signer-workflow MontrealAI/AGIJobManager/.github/workflows/publish-v114.yml --signer-digest EXACT_RELEASE_COMMIT --source-digest EXACT_RELEASE_COMMIT --source-ref refs/heads/main --deny-self-hosted-runners
sha256sum -c SHA256SUMS.txt
python3 scripts/release/verify-package.py PATH_TO_DOWNLOADED_ASSETS --published \
  --profile manager-explicit-governor-release-v1 \
  --manifest config/explicit-governor-release-v1.json \
  --manifest-sha256 "$(sha256sum config/explicit-governor-release-v1.json | cut -d' ' -f1)" \
  --verifier-sha256 "$(sha256sum scripts/release/release-profile.py | cut -d' ' -f1)"
```

The policy hashes identify bytes from that independently verified release checkout; they are not qualification by themselves. Preserve the reviewed commit/tree and policy hashes together. The inherited nonpublishing candidate profile remains blocked from published mode.

Repeat attestation verification for every asset. Run the checksum command inside the downloaded-assets directory and the package verifier from the trusted source checkout with the asset path. Attestation lookup requires network access; archive verification is offline. Candidate mode accepts eight files; published mode additionally requires `QUALIFICATION.json`. Do not remove it or edit checksums to make verification pass.

Confirm the release metadata reports `immutable: true`, and that release source, manifest, qualification, workflow attestations and uploaded bytes agree. After any separately authorized Pages publication, verify `build-info.json` and the actual public-file inventory against the same wrapper source. The local `.nojekyll` build marker is not a public uploaded file. Publication, Pages deployment and intake activation remain separate decisions.
