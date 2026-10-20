# AGIJobManager v1.19.5 validation boundary

Status: **candidate source; exact-final-source qualification and publication evidence must be checked separately**. This document describes the required scope, not a completed release qualification or live-state report. The final archive and external `QUALIFICATION.json` must identify the exact selected commit, tree, finite source profile and completed workflow evidence.

## Reproducible local checks

Use the repository’s committed lockfiles and Node 22.23.2 or later. These adapter checks use inert local inputs and disposable policy doubles; they do not sign or broadcast:

```sh
node --test scripts/integrations/transformational-work-request.test.mjs
node --test scripts/integrations/four-repo-computer-receipt.test.mjs hardhat/test/four-repo-computer-lifecycle.test.cjs
node scripts/docs/current-release.mjs
node scripts/docs/release-alignment.mjs
```

The transformation tests must distinguish native compatibility from a policy double. Cap, currency, overflow, retained-byte, native-result substitution, authority mutation, stale bindings and deterministic reinspection checks establish only their actual tested boundary. A positive-budget double is not evidence that the native zero-currency pilot supports paid proposals. Native source-set compatibility requires the separately pinned cross-repository test and its actual result.

## Release gates

The exact final source must satisfy the applicable CI, UI CI, Docs Integrity, Security Verification, Mainnet USDC Fork Qualification, Release Candidate Preparation, GitHub Pages and Alpha project handoff gates, with the finite v1.19.5 profile selected explicitly. Preserve historical v1.19.4 policy inputs and records. Earlier runs, an unchanged contract build or a new inventory cannot qualify later source. Consult the published external evidence for actual run IDs and outcomes; none are invented here.

Review the COMPLETE archive’s `RELEASE_MANIFEST.json`, outer validation and `SHA256SUMS.txt` against that exact evidence. A checksum establishes content identity, not independent security review. Local validation or publication does not establish organizational/economic independence, native paid execution, browser acceptance, commissioned real machines, profitability, mainnet readiness or paid-intake permission.

## Preserved boundaries

The Builder remains at its immutable v1.19.4 code pin. Original paper files and their links, previous releases, deployment receipts, compiler inputs, dependencies and deployed bytecode keep their original identities. Latest reported deployment facts remain dated owner evidence; this edition makes no fresh chain observation. No mainnet/ENS operation or production activation is included. See [release scope](../../V1_RELEASE_SCOPE.md), [adapter limitations](../../successor/TRANSFORMATIONAL_WORK.md) and [recovery](RECOVERY_GUIDE.md).
