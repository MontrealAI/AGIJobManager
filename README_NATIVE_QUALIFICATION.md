# Exact-c2 paused-core functional qualification

This is a separately reviewed test harness. It changes no production contract,
compiler, artifact, source manifest, old v114 gate, historical report, package
identity, fee recipient, treasury, ENS custody, or deployed application.

## Contract target

The only production target is commit
`c2f72180d2f0d6ecd5b92d8e5197c5344be2c699`, tree
`8b0d8816ce3cdaa1103d37eaa34f4d40bf72972f`, with ordered parents
`3c974ad3cb1d828e5c89464fd8424d8ae853d9dd` and
`eb6f725e0b40ac81e50a374304e54a5ff6859fcf`.

The new Manager has explicit initial governor constructor ownership, an additive
URI-mode getter and unchanged storage. The complete core is eight linked library
CREATEs and one paused Manager CREATE. There is no configuration or activation
transaction in these campaigns. Manager runtime is 24,412 bytes, leaving 164 bytes
under EIP-170. Exact compiler, 91 source units, nine artifacts and original
six-argument historical Manager artifacts are checked independently.

The workflow checks out this fixed target into `source`, the actual harness
revision into `qualifier`, and original `6484d09a...` into `legacy`. The harness
revision has its own authentic Git identity. Its successful execution must not be
called execution of a newer production source. No mutable target input or
profile fallback is accepted. The selector requires the original legacy checker
and inventory bytes unchanged, or the exact reviewed explicit-governor external
binding. Unknown profiles fail.

## Execution and acceptance

The read-only workflow uses the repository's existing pinned actions, Node
22.23.2, existing exact npm locks, and separate compiler outputs. Compilation is
serial with a 2-GiB Node heap; tooling and each native runner are serial with a
384-MiB heap. Native execution uses a disposable Osaka chain with a normal
30-million block gas limit, ordinary TLS, a child-only fixture CA and distinct
loopback read/raw endpoints. There is no public provider, provider-backed fork,
real wallet, Ledger/device, signing secret or deployment endpoint.

Before, between and after the native campaigns, source and harness bytes/actual
Git identities are checked. Complete local Git objects are required. Observers
force no lazy fetch and prohibit all Git transport fallback. The hosted checkout
steps are the explicit authorized acquisition stage; an observer never fetches
missing objects.

The full campaign requires all 96 cases, 355 native/disposable-signing command
records and 18 positive core receipts. The marker campaign requires all 30 cases,
118 command records and nine positive core receipts. No skipped, crashed,
timed-out, oversized, redaction-failed, source-drift or report-tampered case passes.
Negative operations have their exact expected submission/recovery boundaries;
seven full-suite post-submission interruption cases deliberately are not claimed
as zero-send cases. A narrowly reviewed cleanup-race oracle permits only the
exact conservative retained command gate, preserving foreign locks and all other
journal state.

The wrapper verifies the exact ordered case and command inventories, compiler
input/output, source and artifact hashes, receipt/plan/signing-hash bindings and
all shareable evidence hashes. It preserves raw reports unchanged. Successful
completion sets only `functionalCampaignsComplete`; `acceptanceComplete`,
`nativeCLIQualified`, configuration and activation authority remain false.

Only the explicit checked shareable allowlist is uploaded. Private fixture keys,
raw signed transaction capabilities, signed/private directories and source-probe
trees are excluded. Unsafe or incomplete evidence is preserved locally and
produces only generic hashed failure diagnostics. This relies on a trusted,
exclusive test-runner filesystem. Identity rechecks are not protection against
hostile swaps between checks or a compromised runner/runtime.

## Retained actual-c2 compatibility execution

`config/c2-fork-provenance.json` records the already observed GitHub run
38938835872, job117101084362, artifact12062186789. Eleven actual-USDC and 23 cutover
compatibility cases passed; the overall workflow failed its comparison against
the preserved older next-deployment report. The exact artifact report is
byte-identical to the existing immutable
`docs/qualification/history/mainnet-cutover-3c974ad3-compatibility.json`.

The offline verifier checks the fresh execution provenance, exact report and all
76 source hashes against bound c2. It does not rerun a provider fork, change the
older report, promote the overall failed workflow, or infer distinct final-
governor/native-signing acceptance from the fixture's older handover assertions.
Full original job logs and artifact ZIP remain retained separately with their
hashes. The new receipt identifies them without rewriting their bytes.

## Boundaries still open

The earlier local child `25379ef1...` has the same tree and passed full96 and
marker30; it has a different commit and parent list. This wrapper deliberately
rejects it as an actual-c2 run. Its original failures and corrected results stay
separate. This new wrapper/workflow has not yet run at a real hosted harness
checkpoint when prepared locally.

Actual selected-creator/dependency observations, trustworthy actual-state
no-invocation evidence, physical manual Ledger approval, Mac-authoritative
campaign history and independent transaction validation, real receipt/runtime
readback and explorer acceptance remain separate operational requirements.
Ubuntu may propose/build/relay exact approved bytes; its journal cannot authorize
the trusted Mac. Creator changes require regenerated plans and reconciliation of
outstanding signing/submission capabilities. Governor remains explicit d76.

Contract economics and old deployed contracts/funds/permissions are untouched.
Optional ENS/router/metadata, new governor configuration, activation, website and
release/package work are outside this minimum paused-core slice. Slither's
source-binding stop is only reported; its 122 raw results are not a vulnerability
disposition. External audit and Sepolia are owner-accepted omissions, not passes.
