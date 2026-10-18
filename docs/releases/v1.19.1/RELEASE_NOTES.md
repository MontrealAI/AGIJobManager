# v1.19.1 — Release guide clarity and preserved source evidence

This patch clarifies the generated release guide and advances the root, Hardhat, UI and deployment-registry software labels from v1.19.0 to v1.19.1. The guide identifies the current software version, links to its matching release/download availability and keeps the previous published release as a historical reference. It no longer treats a release's preparation snapshot as an evergreen statement that the version is unpublished.

The previous stable release is immutable [v1.19.0](https://github.com/MontrealAI/AGIJobManager/releases/tag/v1.19.0), source `7438cd746dd201fdaa3c6fe4555d11a77b43d2b7`, tree `4bfb78e8a03447e0adccb9da14dd2cde84dba721`. Its source, assets, qualification and historical preparation guides remain preserved. Exact final-source qualification and publication evidence are supplied in the external `QUALIFICATION.json` and publication workflow. Previous release results cannot qualify later metadata, documentation or packaging changes. See [validation](VALIDATION.md).

## Preserved source

The immutable integrated baseline remains commit `8815ed3181778664595f951befd672afbd7a9352`, tree `913e49d65263bc53026916f7fc3b4cbfb93549f8`. This patch changes no Solidity, compiler behavior, dependency resolutions, deployment scripts or executable runtime. Inherited capabilities include:

- Explicit governor selection, source-bound creator profiles, finite deployment inventories and recoverable creation journals. Creation and owner configuration remain separate operations.
- Bounded read-only preflight retry for an observed block rollover, retaining source-bound regression and verifier checks.
- The pinned Solidity 0.8.37 optimizer mitigation removes the affected `L` and `E` passes while retaining the selected cleanup sequence, via IR, 40 runs and Shanghai target. Compiler semantic checks, static-analysis dispositions and executed fork evidence retain their own source bindings. See the [integrated candidate record](../../qualification/INTEGRATED_CANDIDATE_20261017.md).
- Candidate artifacts are compiled before release preflight. The complete source, standalone USDC console and English/French SUCCESSOR Builder assets remain in the existing release inventory.

New version-specific fork and static-analysis comparison inputs preserve the historical observations and finding dispositions. Changed software-version hashes identify the new inputs; they do not claim new execution. All eight required workflows must pass on the exact final main source before publication.

## Preserved identities and operational limits

The Builder remains separately pinned to commit `ab516fbd32fd7cf1a9620fd630947fee1455fca2`, tree `b011643b56115c5baa39ca796cbf0a944c152eda`, version 1.17.2. Its selected source, retained context and editable-source inventory must remain consistent. A newer release wrapper must not replace its source identity.

Existing deployments, jobs, credits, claims, compiler inputs and historical qualification records retain their original identities. The [reported mainnet snapshot](START_HERE.md) is separate operational evidence; this edition neither redeploys that instance nor rewrites its record. Six Exact Matches plus three Similar Matches do not mean nine Exact Matches.

Publication requires fresh qualification on the exact final wrapper, reproducible assets, clean extraction, uploaded-byte verification and repository/workflow/source-bound attestations. The external qualification and publication workflow establish whether those requirements have been completed for the exact release source. This software release does not establish activation, live paid work, independent audit, live-provider qualification or production readiness.
