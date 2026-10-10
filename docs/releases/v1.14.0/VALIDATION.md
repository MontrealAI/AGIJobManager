# Qualification model and evidence

The final release source is one commit S and its Git tree T. Source metadata deliberately remains `prepared`; there is no metadata commit containing its own hash. Six independently completed workflows qualify S:

| Workflow | Required evidence |
| --- | --- |
| ci.yml | Four contract shards, build/lint/size, browser console, simulation and demo checks |
| ui.yml | UI lint/typecheck/unit/fuzz, build, browser/accessibility/header and deterministic artifact checks |
| docs.yml | Generated documentation and ENS documentation integrity |
| security-verification.yml | Deployment tests, dependency audits, Foundry unit/fuzz/invariants and reviewed Slither findings |
| mainnet-fork.yml | Actual Circle USDC and ENS cutover on a pinned isolated fork |
| current-state-release.yml | Protected-source boundaries, preflight, real compiler/local registry, offline release gates, reproducible package and extraction smoke |

Every required job verifies its actual checkout and prints one `QUALIFIED_SOURCE_COMMIT` marker. Publication checks immutable workflow ID/path, repository, source, event/ref, run attempt, successful required jobs and named critical steps. Missing, stale, skipped, cancelled or partial evidence is rejected. PR results qualify the proposed head for review; publication requires new successful push runs on the resulting main commit.

`publish-v114.yml` is a distinct manual workflow. After reviewing completed main-source runs and candidate assets, dispatch it on main with `PUBLISH_v1.14.0`. It downloads the immutable candidate artifact, verifies its GitHub digest and all package checksums, runs a fresh extraction smoke test, and generates external `QUALIFICATION.json` binding S/T, workflow evidence and asset hashes. It then creates an exact tag/draft, verifies uploaded asset digests and publishes. It never force-moves a tag or overwrites a published release. This avoids requiring the publishing workflow to have already finished itself.

The default branch and workflow-write permissions remain authoritative. An inability to edit a workflow is a permission blocker, not permission to transport executable changes through unrelated files. Do not merge temporary PR #1560.

Historical `MAINNET_EVIDENCE.json` is a reviewed, sanitized observation, not fresh final-source qualification. Original saved deployment Standard JSON/build-info/artifacts and the original reviewed NFT policy were not supplied in this handoff. Native tests reconstruct the recorded runtime hashes from the release build; they are not a replay of the missing original build files. Final-source CI, local synthetic tests, native local EVM tests, public-chain fork tests, independent AI code review and any human/security audit must remain separately identified.

No public-chain transaction is part of this release. No deployment, ownership change, approval or intake activation is authorized. Fresh mainnet reads are not claimed unless separately recorded with their actual block/hash and provenance.
