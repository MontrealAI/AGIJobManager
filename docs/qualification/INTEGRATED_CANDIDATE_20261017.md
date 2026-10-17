# Integrated compiler and creator candidate

This candidate integrates source and qualification tooling for a fresh future deployment. It does not select a deployment source, authorize a transaction, commission a system or modify an existing deployment.

## Source lineage

- Integration base: `cae39d198017595382949ad6efc69f36fa8c028b`, tree `4beda66094ffadca6f6b02a8217ff69c3524458b` (PR #1597).
- Selected regression and qualification improvements were reviewed against PR #1598 at `9c35f250e110e7df277ae255b707d31ef2fb1ae6`.
- Production Solidity, explicit governor constructors, the public URI-mode getter, creator transport, catalog/nonce bindings and recovery machinery are retained from the integration base.
- The final exact commit/tree and completed run IDs belong in the draft PR and its external source-review binding. This document is scope, not a self-issued source binding or qualification certificate.

The active `c174b0552cf50ed13e3b98d74176544d45b4d200` deployment retains its original checkout, session, plan, artifacts and deployment records. This candidate must never be substituted into that campaign. Any fresh deployment follows qualification and requires its own source-bound artifacts and plan.

## Compiler and qualification changes

The pinned Solidity 0.8.37 profile uses the upstream default Yul optimizer sequence with only LoadResolver (`L`) and EqualStoreEliminator (`E`) removed, retaining its cleanup sequence, via IR, 40 runs and Shanghai target. The central helper and the actual emitted Forge configuration, Standard JSON and metadata remain checked. A stable fixed-compiler upgrade requires separate qualification; the current mitigation does not change existing compiler-version warnings or deployed bytecode.

Compiler semantic tests retain all three upstream negative controls and add memory-hash and raw-Yul storage-alias coverage. Deployment preflight rejects missing mitigation and reintroduced affected passes. Historical reconstruction uses original source, ABI and optimizer settings, preserving recorded runtime hashes.

The pinned Slither selection is retained in full and ordered deterministically for all three scans. Analysis uses clean full compiler inputs. A new candidate-specific reviewed record binds the actual compiler/profile and analyzer inputs; historical acceptance records remain unchanged. Findings are retained and individually dispositioned, including inherited findings; a pass is not a zero-findings claim.

Pages preservation and source packaging recognize only explicit reviewed changes with exact historical before-bytes and current after-bytes. A specifically attributed historical preservation-test fixture retains the original test. Current fork evidence must come from actual execution; historical observations and expected-only reports remain unchanged and cannot be promoted to execution evidence.

## Qualification dependency order

1. Complete and independently review the finite integration inventory.
2. Freeze one source commit/tree. A clean checked-out identity check proves bytes only; externally reviewed binding remains a separate requirement. Both report `releaseQualified:false`.
3. Run all required hosted checks for that exact source: contract CI, UI, documentation, security, native-USDC/ENS fork, source-package reproducibility and Pages preservation/browser checks.
4. Independently bind the creator harness to the frozen source, exact policy hashes and actual newly generated build catalog. Execute its full unit/CLI/semantic coverage and both disposable CREATE campaigns without skipped tests.
5. Retain the actual outputs and describe each remaining limitation before selecting a fresh deployment source.

Earlier successful results from #1597, #1598 or #1599 remain evidence for their own commits. They are not cumulative qualification for this integration.

## Scope limits

Source packages are nonpublishing previews. The inherited package version and historical release guides do not select a new release; release identity remains unselected. Candidate-only package metadata must be rejected by publication verification. No tag, release asset or historical guide is replaced.

Disposable local EVM transactions use synthetic test accounts. There is no real-key signing, public-chain broadcast, Ledger operation, activation, signer-control proof or claim of a flawless build. Source correctness, packaging, creator behavior, operator authority and live operational readiness remain separate evidence scopes.
