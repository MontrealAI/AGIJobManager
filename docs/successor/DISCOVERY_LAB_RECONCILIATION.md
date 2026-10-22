<!-- SPDX-License-Identifier: Apache-2.0 -->

# Discovery source-only baseline reconciliation

This local candidate normal-merges the existing Discovery source into actual
maintenance main `900bb4b46cb7de7f6f69f553a5687866f978a413`, tree
`bc42f0b295a649900667dcb1c487122726df7a02`. The v1.19.6 publisher and published
assets are separate; no publication or release qualification is granted here.

The explicit `discovery-lab-source-candidate-v2` profile retains every main
blob/mode except five reversible dispatcher insertions. It adds the existing
Discovery receiver inputs, preserves all four historical v1 profile/control/test
files exactly, and admits only the listed v2 policy/test/guide additions. The
workflow uses the new source-only policy, keeping the original Alpha0385 source
pin unchanged. That old pin does not qualify the newer flagship implementation.

The profile refuses publication and emits `releaseQualified:false`,
`publicationApproved:false`, `executionApproved:false`, and `releaseIdentity:null`.
It authenticates the main inventory tree and raw baseline bytes, current Git root,
complete ancestry, index and raw source modes, plus the unchanged compiler closure.

## Remaining release work

This is not a Discovery v1.20.0 release profile. The unchanged maintenance
preparation/scanner/Pages/publisher policies continue to reject this expanded
source. Those failures must remain real; no checks are waived or relabeled.
A separately reviewed v1.20.0 admission must bind final immutable Alpha sources,
software version/generated assets, exact added paths and inherited dependencies,
full current-source scanner/native/browser acceptance, and guarded publication.

Integrate after successful maintenance publication and downloaded-asset checks.
Preserve both merge parents and the original package-input ancestry. Re-run the
supported v2 source package checks on the actual eventual integration commit.
Local draft results do not transfer to the public source, hosted checks, release
or operational deployment. No credentials, wallets, funding or activation change.
