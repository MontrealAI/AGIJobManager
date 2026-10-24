# Zod 3 constrained-collection compatibility backport

This private local fork is `zod@3.25.76+agijobmanager.1`. It retains the MIT
license, published Zod 3 runtime, declarations and TypeScript source from the
authenticated `zod@3.25.76` registry archive. `UPSTREAM.json` records that archive's
SHA512 integrity, SHA1, SHA256 and each retained original file's SHA256.

The root and `zod/v3` exports retain the existing Zod 3 API. This is a **v3-only
component**, not the original dual-version distribution: the old bundled v4,
v4-mini, v4/core and locale exports are deliberately omitted. Consumers requiring
v4 must resolve separately to qualified registry `zod@4.6.6` or later. Review the
actual consumer import graph before selecting this component.

The narrow behavioral repair follows the early upper-bound rejection principle
in upstream [PR 6652](https://github.com/colinhacks/zod/pull/6652). An existing
`array.max`, the upper side of `array.length`, `set.max`, or the upper side of
`set.size` now returns the existing aborted result immediately after recording
its existing size issue, before element parsing or later refinements. It adds no
new size limit and no Map API. The CJS, ESM and shipped TypeScript implementations
carry the same three changes; declarations and other retained source bytes are
unchanged. Below-cap parsing, too-small checks, async parsing, preprocessing and
explicit fallback behavior retain their existing meaning.

**Unbounded arrays, sets and maps are unchanged.** Minimum-only schemas still
traverse their elements. This backport does not cap total accumulated errors,
establish global resource-exhaustion resistance, or claim complete eradication of
[GHSA-mrhx-c7xc-m3w5](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5). The official
v4 fix also leaves unbounded containers unchanged. The maintainer states in
[issue 6653](https://github.com/colinhacks/zod/issues/6653) that new v3 versions are
not being published. This fork is not an upstream release or a disguised v4
upgrade.

AGIJobManager selects this fork through explicit local Zod 3 dependencies and
per-major overrides in its root, Hardhat and UI lockfiles. The UI's Zod 4 consumer
remains a separate registry `zod@4.6.6` dependency. This selection changes no
transaction defaults.

The original npm audit finding remains attached to its original lock/source.
The retained Node 22 registry audit reports this honest Zod 3 version as
affected; that raw failure is retained. A newer npm version can return an empty
registry report without auditing the local component. A separate, source-bound backport disposition checks the
exact reviewed vendor, lock graph and installed resolutions and refuses unknown
findings or drift. That disposition does not turn the registry audit into a pass
or establish global resource-exhaustion resistance. Provenance, bounded refusal
tests, real consumer compatibility and independent source-specific review remain
separate evidence; release qualification and publication require their normal
exact-source process.

The `scripts/security/zod-constrained-collections.test.cjs` regression uses at most
three collection elements. It exercises both CJS/ESM and root/v3 entrypoints,
including declared upper-bound refusal before element/refinement work and
explicitly unchanged unbounded behavior. Run the same file against authenticated
upstream with `ZOD_FIXTURE_PATH` to preserve the original failing controls.
