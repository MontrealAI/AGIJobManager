# Authorized v1.14.0 security dependency repairs

On 2026-10-10, the maintainer explicitly authorized the documented security
dependency repairs and necessary UI compatibility changes, followed by full
requalification and publication. This is the scoped exception to the original
handoff's dependency freeze. All six qualification workflows and audit thresholds
remain mandatory.

## Reconciliation with operator evidence

The private deployment terminal transcript records `npm audit fix --package-lock-only`,
then `npm ci`, and zero root and Hardhat audit findings before deployment. It
identifies `http-cache-semantics` 4.2.0 → 4.3.0 and `serialize-javascript` 7.1.1 →
7.1.2. This release adopts exactly those two root lockfile changes. These Node
tooling packages do not alter Solidity source or deployed bytecode. The transcript
is historical evidence and is not shipped in the public repository.

## Reviewed changes

| Component | Repair |
| --- | --- |
| Root cache/serialization tooling | http-cache-semantics 4.3.0; serialize-javascript 7.1.2 |
| Next.js and matching ESLint configuration | 15.5.27, including matching platform SWC packages |
| UI selector parser | postcss-selector-parser 7.1.6 |
| UI image processing | sharp 0.35.5 and its libvips 1.3.4 platform dependencies |
| UI source maps | source-map-js 1.2.2 |
| Brace parser used by Tailwind, file watching and linting | Transparently versioned local fork 3.0.3-agijobmanager.1; all affected transitive consumers resolve to this source |

The brace-parser advisory had no published upstream patch. The local compatibility
repair bounds combined brace/parenthesis nesting, validates ASTs iteratively,
rejects child/parent cycles and shared-child amplification, preserves the hard
input length despite `NaN`, bounds recursive expansion queues and iterates array
flattening. It preserves normal glob/range behavior and the existing Tailwind
design. It does not claim general Cartesian-expansion or output-size safety.
See `ui/vendor/braces/README.md` and the integrity-bound upstream provenance.

Independent adversarial review found an additional supplied-AST/external-parent
queue bypass in the first repair. The final repair closes that path and includes
deep/cyclic queue and non-string node-value regressions (including implicit string coercion in compile/stringify). This is AI code review, not a claim
of a human security audit.

`config/v114-dependency-repairs.json` enumerates exactly two root and 43 UI
lockfile-entry changes with before/after hashes, plus the reviewed vendor file
inventory and hashes. The release boundary checker rejects unrelated dependency,
vendor, contract or compiler drift. Its mutation tests exercise those refusals.
Hardhat dependencies, Solidity 0.8.37, Hardhat 3.17.0, ethers 6.17.0, OpenZeppelin
4.9.6, compiler settings, contract ABI/economics and linked-library identities are
preserved. Native qualification reconstructs all nine historical runtime hashes.

## Evidence and final qualification

The three `security-audit/*-after.json` reports record zero registry findings for
fresh root, Hardhat and UI audits. Earlier reports remain labeled historical in
`BLOCKERS.md`. Registry audits do not inspect locally vendored source; the fork's
provenance, implementation review and eleven adversarial/compatibility tests are
separate required evidence. The standard UI test command runs those tests before
the 178 application tests.

Local UI lint, typechecking, application tests, production/IPFS build, native
registry/runtime tests, cutover tests, release gate tests and boundary mutation
checks passed. Final exact-commit GitHub results, including browser, Foundry and
Slither qualification, are recorded in the release PR. Publication additionally
requires all six successful final-main-source runs in external `QUALIFICATION.json`.
This source document never labels an unexecuted final-source gate as passed.

No public-chain write, redeployment, ownership change, token approval or intake
activation is part of these dependency repairs.

The fresh Slither 0.11.6 reports from PR run 38058718461 match every existing reviewed finding identity, detector, severity and confidence: 12 extended, 29 reentrancy and 122 all-detector entries. The source-bound gate correctly rejected the changed root lockfile fingerprint. Only that fingerprint was refreshed after confirming the exact two authorized Node tooling repairs; no finding, rationale, detector or acceptance threshold was removed or changed. The immutable Actions evidence envelope SHA-256 is `3e2ca04ec314abe2f5da29d7dc99e2d28fb1140de8035729df11ed535dea43c2`. Final-source reruns remain mandatory.
