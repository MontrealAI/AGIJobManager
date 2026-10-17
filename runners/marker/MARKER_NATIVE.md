# External marker-only native increment

This small external harness extends the frozen combined-r5 native runner without
changing the source tree, prior runner or prior results. It accepts only `--suite
marker`; the original empty-EOA/strict-delegated full run remains a separate gate.
All production CLI commands execute in the selected genuine clean local checkout.
The exporter binds actual observed Git identity and real compiler/catalog inputs.
No `fixture.source` or source-identity injection is used.

## Scope

- Nine actual production-CLI direct type-2 CREATE handoff/import/relay/recover/
  reconcile operations, followed by paused d76-owned completion.
- A disposable marker account and INVALID target are set only through local EDR
  initial-state methods. No authorization transaction changes any real account.
- Exact nine operations come first from an actual offline CLI empty-policy draft.
  That draft is never preflighted or used for a session on the marker account.
  The marker plan binds actual source/build/catalog/block and those operations.
- Input consensus/execution report objects are explicitly synthetic fixtures.
  Their placeholder artifact hashes are not independently reviewed evidence.
  Separately retained real local post-execution traces do not retroactively
  qualify the synthetic inputs or establish public-account/provider/custody safety.
- Thirteen policy/evidence negatives (including a changed creator with stale old-wallet evidence), six actor-state negatives before each of
  handoff and relay, nonce drift before each, and restored-state native preflight
  controls. Detailed planner/actor reasons are checked at module boundaries;
  native errors must be exactly redacted, preserve session state and send nothing.
- Nine structurally checked bounded opcode traces inspect all four call opcodes, reject
  creator/target calls and every marker-bearing indirect callee, and retain exact
  canonical receipt-block callee code. This is local test evidence only.
  Those code reads are post-state observations at the receipt block, not
  execution-time code observations. The strict trace checks reject nested
  CREATE/CREATE2/SELFDESTRUCT and marker callees; they do not establish universal
  trace completeness or an execution-time code proof for arbitrary providers.
  Structural bounds and frame checks cannot prove that interior trace rows are
  present; receipt-block code is end-of-block state and may differ from code
  present during execution. Both limitations remain explicit in each trace record.
  Neither EDR traces nor the local finalized-to-latest mapping establish public
  consensus finality, production delegate safety or physical-wallet custody.

The two loopback HTTPS endpoints, normal TLS verification, child-only ephemeral CA,
Osaka chain ID 1, normal 30m block gas, EIP-170, clean child environments, private
raw exclusion and explicit EIP-1898/finalized fixture adaptations are inherited.
No installation, public provider, real keys, remote action or workflow is used.

## Commands

Use actual expected commit/tree supplied after the local checkpoint is created:

```sh
NODE=/workspace/shared/manager-tools/node22/node_modules/node/bin/node
HARNESS=/tmp/manager-marker-native-harness-r2-20261016
env -i PATH="$(dirname "$NODE"):/usr/bin:/bin" HOME=/tmp LANG=C.UTF-8 \
 "$NODE" --max-old-space-size=384 "$HARNESS/scripts/qualification/core-session-native.mjs" \
 --source-root "$ACTUAL_CLEAN_SOURCE" --output "$FRESH_EXTERNAL_OUTPUT" \
 --expected-commit "$ACTUAL_COMMIT" --expected-tree "$ACTUAL_TREE" \
 --build-id marker-native-local --suite marker
```

Do not run heavy EVM work without the coordinated serial window. The standalone
lightweight checks use `node --test --test-concurrency=1
hardhat/test/marker-native-evidence.test.cjs`. Copied legacy harness tests are
retained for base-file identity only, not a standalone external test suite.

Report identities distinguish actual production source and external harness.
`acceptanceComplete` and `nativeCLIQualified` remain false; marker-only passing
results cannot replace the original full suite or live-account qualification.
Preserve every failed run and use a fresh output path after corrections. Public reports, logs, raw opcode traces and `SHA256SUMS` can be retained or shared
after redaction review. Use the manifest-listed public evidence files rather than
the entire directory; private signed capabilities and keys remain excluded.

## R2 historical-pin isolation correction

The first actual local native marker run is retained as FAIL: 20/21 cases, 103 commands and 9 successful core receipts. After the actor-code mutation group, its restored-state control failed. The first hardhat_setCode modified the EDR current block, which was also the plan pin; mining only afterward preserved an altered historical pin. Subsequent native negatives could stop at that pin rather than the intended latest-state condition. No later-negative cause claim or overall pass is retained for that run.

This external test-only revision mines beyond the plan pin before any state mutation. It observes the original pinned creator/target/governor state and canonical hash before and after advancing, after each mutation and after restoration. Each intended negative is now asserted through the complete production preflight path, followed by the real redacted CLI rejection and unchanged session/zero-send assertions. Restored-state controls require both module and native preflight success. No production source, actor check, plan evidence, canonical-tag requirement or original failed artifact is changed.

Nine lightweight helper tests pass, including refusal of stale pins or ineffective mining. Their model-level mutation ordering test is not actual EVM evidence; the fresh native campaign remains to be executed separately. R1 source and reports are preserved.
