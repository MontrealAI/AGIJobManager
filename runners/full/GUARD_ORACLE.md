# External full-harness retained-guard oracle correction

This revision changes only the external test harness. Actual local source
25379ef1b0f484fea6bf559bf4a0b41e43a2e699 / tree
8b0d8816ce3cdaa1103d37eaa34f4d40bf72972f, the failed full-native-001 run and the
separate marker increment remain frozen.

## Preserved finding

The first actual combined-source full run stopped after 9 valid core receipts:
23/25 case records passed (the failed completion subcase also failed its enclosing
positive workflow). Command 98 correctly rejected the injected foreign-lock race
with exact redacted stderr, reserved-only output and zero raw sends. Its durable
session digest differed solely because production deliberately retained the new
active-command guard. Removing that entry only from a read-only digest calculation
exactly reproduced the prior digest. No evidence entry was removed or rewritten.

Production binds lock membership at command entry and checks it again before
cleaning the active command guard. A foreign lock appearing across awaited RPC
causes that final check to fail and retains the guard for reconciliation. Existing
production boundary tests explicitly require this retention. The prior test oracle
incorrectly required that new guard to disappear.

## Narrow correction

Only `completion-cleanup-race-preserves-another-session-lock` for a `complete`
command can use the retained-guard oracle. There is no generic option to skip or
relax the durable-state assertion. All other failed commands retain the previous
whole-session digest equality requirement.

Before the command, the oracle requires an already released session, no active
command entry, no original creator lock, and a differently owned injected lock.
It captures every non-gate session directory/file's device, inode, mode and exact
bytes (including signed and attempt files), plus their complete membership digest.
At the RPC hook, before injecting the foreign lock, it captures the active gate
and its owner file's device, inode, mode, exact bytes, owner token and PID.
Immediately after injection it captures the foreign lock directory and owner in
the same way. After the CLI rejection, every captured identity and byte string
must still match; the non-gate digest and all entry membership must be unchanged.
The CLI still must exit 1, emit exactly the generic error, retain only a reserved
output and make zero raw requests. No journal, signed capability or attempt may
advance. Evidence contains identity fields and hashes, never private signed bytes.

This race is now the last completion subcase. Its retained gate and foreign lock
are kept in place. No later case cleans or reuses that session. The following
strict-delegated campaign uses its own fresh disposable creator/session.

## Tests and run status

19/19 lightweight oracle tests passed, zero skips (`unit-r1.log`), with a genuine
exact-retention positive fixture. Negative controls include same-byte file inode
replacements, head/signature/attempt/journal changes, new files, gate/foreign-lock
owner bytes, inode/directory substitutions, modes and unexpected entries. Native
runner syntax check passed. These are test-oracle checks, not native qualification.

The full source-bound native rerun is pending its coordinated serial EVM window.
`RUN_COMMAND.sh` is the precise 384 MiB command with all four genuine historical
catalog flags, actual source identity and a fresh full-native-002 output directory.
Do not execute it while another heavy EVM job is running. Preserve failures under
that new run directory; do not replace the earlier report.

`GUARD_ORACLE_INCREMENT.json` records all base/new hashes and frozen evidence.
`GUARD_ORACLE_INCREMENT.diff` is the runner delta; the new helper/test/document are
separately inventoried. No source/artifact/dependency archive was copied, and no
installation, provider, live key, remote upload or workflow change occurred.
