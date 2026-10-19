# Disposable native core CLI qualification

This harness runs the unmodified production CLI in fresh Node subprocesses against
its **actual observed clean Git commit/tree**, exact compiler artifacts and pinned
catalog. It never injects `fixture.source`, trusts a dirty checkout, edits the
production transport, or treats module-API success as native CLI success.

## Scope and status

The normal `node --test hardhat/test/*.test.cjs` suite includes only twelve lightweight
harness tests. Those tests do **not** run, skip, or satisfy the dedicated native
qualification gate. Run the command below explicitly. A clean checkpoint containing
these harness files is required before claiming the final source-bound native gate.
Running this harness externally against an earlier genuine source commit is useful
bounded evidence; its report records `sourceIncludesHarness: false` and hashes the
separate harness files.

Only nine direct type-2 CREATEs are modeled: eight libraries and the paused Manager,
with explicit governor `0xd76AD27a1Bcf8652e7e46BE603FA742FD1c10A99`. Governor
configuration, helper/router, ENS custody/approvals/fuses, metadata and activation
remain separate. Package/release identity is not selected here.

`PASS_IMPLEMENTED_CASES` means every case selected by that invocation passed.
It does **not** mean the entire reviewed acceptance plan is complete. Read
`acceptanceComplete`, `notYetQualified`, `suite`, and every case outcome. Source-only
runs have no receipts. A positive run has 18 core receipts across two disposable
workflows. No workflow is wired into Actions by this implementation increment.

## Preserved first native run

The external harness against genuine historical commit
`3c974ad3cb1d828e5c89464fd8424d8ae853d9dd` completed both positive workflows (18
canonical-local core receipts). Its full run recorded **96 cases: 93 passed and
three failed**. After the child loaded its pinned files, a test-only RPC reply hook
changed a private catalog, Manager artifact or compiler-source closure file. All
three handoffs incorrectly succeeded and appended a durable signing authorization.
Those before-fix reports and journals must remain intact; the full gate is FAIL.
The selected historical checkout itself was unchanged.

Lock contention, cleanup races, dual-root export boundaries and the authentic
six-argument historical catalog case passed in that run. A separately reviewed
late-revalidation correction requires a newly identified real source checkpoint
and its own tests. Passing targeted correction tests will not replace the final
full, source-bound native qualification. This implementation slice still reports
`acceptanceComplete: false`; reviewing final acceptance computation is a prerequisite
to wiring a CI gate. No actual-provider, physical-wallet, historical-6c8-delegate,
configuration or activation qualification is implied.

## Prerequisites

- Exactly Node **22.23.2** and the reviewed source commit/tree, both lockfiles and
  compiler settings. No dependency installation is performed by these scripts.
- Already-present pinned dependencies, including solc 0.8.37, Hardhat 3.17.0 and
  ethers 6.17.0, with the reviewed OpenZeppelin compatibility patches verified.
- Freshly compiled exact-source `hardhat/artifacts` with intact build-info input
  and output. Do not compile into an artifact directory shared with another run.
- The `openssl` executable for a one-day ephemeral loopback fixture CA/certificate.
- An existing real external operator parent directory, without symlink ancestors.
  Every run must select a fresh unused output directory.
- A reviewed local-only execution decision. No public provider, wallet, credential,
  installation, machine-trust change or remote write is part of this harness.

Compile separately, observe the clean source before and after compilation, then
select the exact expected full commit/tree. Build outputs must remain ignored; a
source/index/untracked/mode problem is a failure to reconcile, not a reason to add a
source-observer exception. The exporter checks the complete compiler source closure,
all nine artifacts, ABI/creation/runtime templates, links, immutables and schemas by
calling the existing qualified-build catalog loader.

## Commands

Use absolute paths appropriate to the machine. This example invokes the external
harness and explicitly selects the reviewed target; it does not invent a commit.

```sh
NODE=/absolute/path/to/node-22.23.2
HARNESS=/absolute/path/to/reviewed-harness
SOURCE=/absolute/path/to/actual-clean-source
PARENT=/absolute/path/to/existing-private-operator-parent
COMMIT=<reviewed-full-40-character-commit>
TREE=<reviewed-full-40-character-tree>

env -i PATH="$(dirname "$NODE"):/usr/bin:/bin" HOME="$PARENT" LANG=C.UTF-8 \
  "$NODE" "$HARNESS/scripts/qualification/core-session-native.mjs" \
  --source-root "$SOURCE" --output "$PARENT/native-run-001" \
  --expected-commit "$COMMIT" --expected-tree "$TREE" \
  --build-id reviewed-core-build --suite full
```

`--suite source` runs only the source/catalog negatives; `--suite positive` runs only
the two nine-CREATE native workflows; `--suite full` runs both and the implemented
native rejection/interruption cases. Run these memory-heavy EVM jobs serially.
There is no implicit fallback to a different suite or source identity.

For the authentic historical negative, provide all four optional flags together:
`--legacy-source-root`, `--legacy-artifacts-root`, `--legacy-commit` and
`--legacy-tree`. The source root may be an exact archival extraction: the harness
verifies every tree entry against the actual historical Git tree available through
the selected checkout, verifies the complete compiler source closure and all nine
artifacts, and labels it as an archive rather than a native checkout. The historical
catalog stays bound to its own true commit/tree and six-argument constructor. The
current native CLI must reject that cross-generation source identity; a separately
labeled API-only negative checks the new planner's six-argument schema rejection.

For an offline catalog alone:

```sh
"$NODE" "$HARNESS/scripts/qualification/prepare-core-catalog.mjs" \
  --source-root "$SOURCE" --output "$PARENT/catalog-001" \
  --expected-commit "$COMMIT" --expected-tree "$TREE" \
  --build-id reviewed-core-build
```

Catalog preparation does not compile, install, sign, contact an explorer or make a
network request. Its Git helper forces `GIT_NO_LAZY_FETCH=1`, an empty allowed
protocol list, and `protocol.allow=never` after scrubbing inherited Git variables.
Missing promised objects fail locally instead of invoking a fetch; a disposable
local-only upload-pack sentinel regression verifies this even under inherited and
repository-local protocol overrides. Descriptors pin exact existing source/build paths; keep those files
available and unchanged for the native CLI. It verifies rather than applies the
OpenZeppelin compiler compatibility patch. Both the Hardhat release+commit compiler
identity and solc-js's platform-suffixed installed version are recorded.

## Redacted CLI rejection boundary

The reconciled CLI intentionally reports a fixed generic error rather than echoing
private parser, path or signing details. Native negative cases require exit 1,
no signal, no timeout or output overflow, empty stdout, and the exact core/export
redacted message. Arbitrary exceptions, crashes, extra stderr and unexpected
successes fail the harness. The lightweight subprocess argument tests exercise
this boundary without claiming a clean source checkpoint or a native EVM pass.

Detailed reasons remain asserted at the module layer. The harness additionally
checks the same invalid source, catalog, signed-envelope and planner inputs using
their production validators before running the actual native rejection. Existing
operator-paths, output, policy, journal/session, private-state and revalidation
regressions retain their module-level reason checks. Command metadata records
`moduleReasonExpectation` only as context; `nativeDiagnosticReasonAsserted: false`
explicitly prevents treating a redacted message as proof of a specific cause.

Every failed existing-session command preserves a digest of all its private
session entries and bytes and asserts no change, except the deliberately submitted
transport-failure scenarios. Those scenarios require exactly one raw HTTP request
and retain their explicit attempt-marker/hash/recovery checks. All other native
failures require zero raw submissions. Existing output and shared-lock bytes must
remain unchanged; newly reserved outputs cannot claim successful operation.
Positive native workflows and final clean-checkpoint targeted/full runs remain
separate required checks. The frozen 93/96 before-fix report is unchanged.

## Native boundary and disposable transport

The CLI receives an allowlisted child environment with a read URL, a different raw
relay URL, and `NODE_EXTRA_CA_CERTS` pointing at this run's public fixture CA. It does
not inherit provider URLs, signing credentials, Node loaders, TLS bypasses, coverage
settings or Git redirection. The fixture HRE is constructed programmatically with
only an `edr-simulated` chain ID 1 Osaka network, ordinary **30,000,000** block gas,
EIP-170 enabled, and disposable test accounts. No source `.env` or public-network
configuration is loaded. The production CLI remains HTTPS-only.

The two HTTPS servers bind only `127.0.0.1`. The CA is trusted only by relevant child
processes; machine trust is never modified. Normal server-name and certificate
validation remain enabled. CA private material is removed after issuance and server
private material after shutdown. Unit coverage proves an untrusted child cannot
connect. HTTP logs retain method/endpoint/id counts, never request raw bytes.

EDR's missing EIP-1898 support is bridged **only in the test helper**: verify the
requested block hash is canonical, make the genuine numbered EVM read, then verify
canonicality again. Each adaptation is recorded. Local `finalized` explicitly maps
to local `latest`. This tests the actual native HTTP and command boundaries; it
cannot qualify public-provider EIP-1898 service or finality/consensus.

The empty EOA and synthetic delegated EOA use newly generated disposable keys. A
separate native signer child receives a key only on stdin, signs the CLI's exact
unsigned envelope, and returns raw bytes only to private operator state. It uses no
hardware-wallet SDK. The delegated fixture uses an actual local type-4 authorization
setup, followed by nine direct type-2 CREATEs. Its source/build/block/Osaka-bound
reports are explicitly synthetic. They do not qualify the historical 6c8 delegate,
a physical Ledger, or an actual public consensus observation.

## Evidence and failure preservation

The external `report.json` uses `manager-native-core-session-qualification-v1` and
records:

- Actual source commit/tree/parents and both lock hashes, observed again at the end
- Separate harness hashes, Node executable hash and tool/compiler identities
- Catalog/compiler-input/output/build IDs and full source/artifact pins
- Every native command, exit/signal, stdout/stderr/output hashes and reserved-only
  output status; external signer records contain hashes, never key/raw stdout
- Selected scenario outcomes, public unsigned envelopes, recovered creators,
  receipt/address/runtime proofs and HTTP method/adaptation counts
- Explicit local-only, synthetic-delegation, provider/wallet/explorer/configuration/
  activation limitations; audit and Sepolia remain owner-accepted omissions, not passes

`SHA256SUMS` names the shareable evidence files. **Do not upload the entire run
folder.** `private/`, `source-probes/`, and session `signed/` folders are intentionally
excluded because they contain disposable signing capabilities or mutable adversarial
fixtures. No raw transactions or private keys belong in CI artifacts. Excluded
private journals still remain locally available for recovery and inspection.

A failure preserves its run directory, reserved output, command stderr, attempt
marker, journal and `INCOMPLETE` marker. It must not be cleaned away or reinitialized
under the same identity. Make a new corrected harness revision and a new run path;
retain the before-fix report. Never retry an ambiguous raw submission. Read-only
recovery/reconciliation must find the original receipt or remain inconclusive.

The source-negative fixture has its own Git index and read-only object alternate.
It links immutable source bytes to save space and detaches every deliberately
mutated file before writes/chmod. It never edits the selected target checkout.
Negative source mutations are restored only inside this disposable probe so later
cases can run; their native rejection records remain in evidence.

## Acceptance boundaries

Both successful workflows prove exact direct type-2 fields, contiguous nonces and
CREATE predictions, zero value, bounded fees/gas, exact runtime/link/immutable
matches and nine canonical-local receipts. Completion stays
`CORE_CREATED_PAUSED_CONFIGURATION_SEPARATE`. Final owner is d76, pending owner is
zero, paused is true, helper/router is unset, settlement wallets are unchanged, and
the creator has no moderator/agent/validator exception. OpenZeppelin's base
constructor emits creator ownership before the derived constructor assigns d76;
there is no usable runtime admin window. Configuration/activation transaction
counts remain zero. Offline verification export is predicted-address/source evidence
with explorer acceptance false; receipt proofs remain separate.

Read `notYetQualified` and the failed case list before interpreting any result.
The preserved full-r1 run includes the authentic six-argument catalog, shared
core/optional reservation contention, completion cleanup races and both export
source-root checks. Its three timed pinned-input mutations are failing regressions,
not omitted cases. A successful correction probe is narrower than a full native
run at the final reviewed checkpoint. Source and harness identities must be recorded
separately until that checkpoint includes the reviewed harness itself.
