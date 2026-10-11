# Mainnet commissioning → supported operator workflow

Starting source: `5f296a14727f3497128f3a49bd628c1f09a96221`, tree
`229c86962bd6dfab24128aea4f29f35832db592e` (verified 2026-10-11).
v1.14.0 is published. v1.15.0 is the proposed capability release; publication,
merge, Pages deployment and intake activation are distinct decisions.
No public-chain writes are part of this implementation.

| Requirement | Existing support | Minimal missing capability / planned files | Verification | Owner |
| --- | --- | --- | --- | --- |
| Historical integrity | Frozen checker and full-record validator | Reuse through one CLI; preserve original bytes | Existing 167 regression cases | Engineering |
| Current core + ENS | Canonical reader, readiness, NFT compiler replay | One snapshot orchestrator; explicit recorded-instance selection; policy, reserve and issuer observations | Coherent-block, reorg, drift and missing-artifact cases | Engineering |
| Approval inventory | Three named historical operators | Bounded event ranges, ordering, active-state reconciliation and completeness disclosure | Gaps, duplicates, truncation, malformed/reorg responses | Engineering |
| Activation A1–A5 | Maintained activation guide | Versioned input template, evidence validation and finite closeout | Missing, stale, conflicting and unauthorized inputs | Engineering; actual decisions: operator |
| Isolated rehearsal | Successful reference v1.5, native lifecycle/cutover tests | Maintained runtime selection and isolated launcher; strict read transport; preserved compiler provenance | Real subprocesses, split/hoisted peers, resolved URLs, stopped launcher precedence | Engineering; original build/archive access: operator |
| Recovery | Deployment journals, explorer-input comparison | Read-only reconciliation route; namespace mode guidance; no automatic redeployment | Nonce/receipt/calldata/code mismatch, incomplete journal | Engineering |
| Human journey | README generator, onboarding, Pages and UI | Recorded-instance route, stage diagram, wallet roles, command help, monitoring | Generators, docs links, browser/accessibility checks | Engineering |
| Candidate qualification | Six qualification workflows plus Pages validation, packaging | Version-consistent preparation and exact-source results | Existing gates and candidate extraction/rebuild | Engineering; merge/publication: maintainer |

## Missing evidence is separate from software work

Original operator compiler caches are not in the handoff. Archive RPC credentials,
actual paid-work participant/signing evidence, operating terms and A1–A5 approvals
must not be invented. Local fixtures establish software behavior only. Historical
deployment and ownership transactions are completed and must not be repeated.

## Compatibility

Keep deployed Solidity, ABI/compiler settings, linked libraries, historical record,
frozen checker and canonical blank transaction defaults unchanged. Preserve all
existing diagrams. Extend maintained components instead of installing historical
overlays. Candidate reports must disclose every blocked or unexecuted gate.
