# Guarded optional-router verification and precise Pages inventory

This patch packages the optional `AGIJobPages` metadata-router tooling merged in [PR #1579](https://github.com/MontrealAI/AGIJobManager/pull/1579), and corrects the public Pages file inventory. It changes no Solidity source, compiler setting, dependency resolution, ABI, settlement rule or deployed contract. The immutable v1.17.1 tag, assets and historical qualification records remain unchanged.

The [optional-router guide](../../DEPLOYMENT/OPTIONAL_METADATA_ROUTER.md) covers explicit read-only planning, guarded deployment, canonical constructor/runtime checks, explorer verification and non-overwriting recovery journals. Successful verification produces a `verified_unconfigured` receipt. The helper remains optional and is not attached to a manager; owner configuration and intake activation need their own authorization. Actual-address explorer verification remains pending until an authorized deployment produces evidence. Tests and a source-compiled 4,212-byte runtime are not a live verification receipt or an independent audit.

The Pages builder retains the empty local `.nojekyll` marker under `buildOnlyFiles`, while `files` lists only public artifacts. The GitHub Pages uploader excludes dotfiles, so the inventory no longer promises a public `.nojekyll` URL. Native same-document fragment navigation is also covered by the merged browser wait correction; normal document navigation keeps its existing wait behavior.

Top-level archive guides now retain usable links to the included source documentation; the source copies stay unchanged.

Root, deployment and UI software labels and generated guides are aligned to v1.17.2. A version-only source-binding update preserves earlier fork outcomes and reviewed static findings as expected comparison fixtures, not newly executed evidence. All seven exact-source workflows, reproducible packaging and final publication provenance remain mandatory. See [validation](VALIDATION.md).

No contract deployment, manager configuration, provider spending, ownership change or activation is included. Existing instances, obligations and original journals remain on their recorded source. The owner's scoped external-review/Sepolia omissions for the second deployment remain recorded in the [qualification decision](../../DEPLOYMENT/SECOND_MAINNET_QUALIFICATION_DECISION.md); automated checks do not become an external independent security review.
