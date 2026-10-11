# Mainnet ENS record and activation-guidance update

## Scope and preservation

This update integrates the completed ENS commissioning as dated public evidence, the unchanged operator-tested read-only connection checker, offline record validation, and a separate production-activation HOLD. Baseline: `47abe97bfc7fbd502482e92e71ba558a9668ccab`. The accessible review is [PR #1567](https://github.com/MontrealAI/AGIJobManager/pull/1567).

No Solidity, ABI, linked libraries, compiler settings, dependencies/lockfiles, workflows, runtime defaults, UI artifacts, release tags/assets or on-chain state are changed relative to the baseline. The generic manager/helper/owner/payment-recipient fields remain blank. Original operator journals and private files are not modified or published wholesale. The successful ENS milestone is not reset to unproven, and production-activation gates are not promoted to approved.

## Local validation

Run from a separate source checkout; these commands do not use RPC, a signer, Hardhat startup or a compiler:

```bash
node --test hardhat/test/ens-usdc-connection.test.cjs hardhat/test/mainnet-evidence.test.cjs hardhat/test/commissioning-docs.test.cjs hardhat/test/mainnet-record-json.test.cjs
node scripts/commissioning/mainnet-evidence.cjs
```

Final local result with **Node 22.16.0: 167 passed; zero failures, skips or cancellations**. This comprises 44 connection-checker tests, 86 evidence-record tests, eight generator/environment/CLI regressions, and 29 strict-JSON/CLI regressions. One evidence-record test individually mutates and rejects **all 267 scalar values** in the historical projection; those mutations are not counted as 267 additional test cases.

Connection positives use synthetic ABI/hash fixtures and mocked RPC responses. Filesystem, subprocess and deployment-generator tests execute the actual scripts. These local results are not a fresh mainnet verification or an independent audit. The existing Security Verification workflow discovers all four `.test.cjs` files through the complete Hardhat `test:preflight` suite. Use the final exact-head CI and review results in PR #1567 for qualification under the repository-pinned Node 22.23.2; passing runs on earlier heads do not qualify later changes.

## Review and repair history

| Stage | Local targeted result | Change |
| --- | --- | --- |
| Initial `b32625a2` update | 94 passed | Curated record, connection checker, initial offline validator and guides |
| `f33d3974` integration repair | 102 passed | Restore default-registry consistency; document reserved Node controls; eight real generator/CLI regressions |
| `b0c6afd2` source-identity repair | 109 passed | Bind both historical Solidity source blobs; seven rejection regressions |
| `787cdb36` complete historical-record validation | 138 passed | Pin dependency addresses, all six transaction/block identities and the entire canonical public projection |
| `95828060` strict JSON and private diagnostics | 161 passed | Reject duplicate decoded JSON keys before fingerprint validation; redact malformed-input and filesystem errors |
| Initialization diagnostics | 167 passed | Load the companion checker inside the sanitized validation boundary; test missing, malformed and throwing dependencies |

The initial Docs Integrity run `38098083421` failed in `ui/scripts/sync-deployments.mjs --check`. Automated review also identified the stale generated deployment guide. The previously reported PR #1593 and script-catalogue diagnosis were not the confirmed repository state.

The repair restores `config/usdc-deployment.json` to base blob `2ca13f8f451f5170d6b23208f570132e887b9e64`. Its original note correctly says that no live manager is configured **by default**. Completed commissioning is separately recorded and prominently linked, not injected into runtime defaults. Both actual deployment generators were executed locally and reproduced their existing committed outputs:

| Consumer | Git blob |
| --- | --- |
| `ui/src/generated/deployments.ts` | `5a030689130036b6d00b57f10220a5557385f52a` |
| `docs/ui/DEPLOYMENT_MAINNET.md` | `c0ef6cdceafe1b10e4cf073af171bc6819233d8b` |

No consumer replacement or UI rebuild is needed. Existing synchronization checks remain enabled. Regressions reproduce note-only drift and verify regeneration in a disposable fixture.

The connection checker's `NODE_OPTIONS` and `NODE_PATH` reads are documented as reserved empty controls. Empty `.env` entries do not clear inherited shell values or undo preloaded code; the launch environment must be reviewed before Node starts. No private operator configuration is edited.

## Complete historical record binding

The read-only [offline validator](../../scripts/commissioning/mainnet-evidence.cjs) accepts one reviewed historical projection, not arbitrary current or newly approved states. Diagnostic checks explicitly bind the manager/helper source blobs, their USDC/ENS dependency addresses, and every transaction hash, block number and block hash. The source blobs were checked against the pinned historical GitHub ref, not against a future checkout's Solidity.

A separately fixed SHA-256 also binds the **entire** parsed public record, including evidence digests, individual fees, timestamps, custody, limitations and activation findings. This catches coordinated edits that would remain internally consistent under selected field checks. Canonicalization sorts object keys while preserving array order and exact scalar values; whitespace and object-key order may change without changing identity.

```text
Original public JSON Git blob: b78082669538f8dd319a3f19f4341dba90c2aaef
Canonical historical SHA-256: 000945c8869f1e6015ba817ce58f8f975c0206deaef6ef9965629091f0f2bb8d
```

The raw JSON loader rejects duplicate decoded property names at any nesting level before validation. A duplicate true-valued authorization inserted before the recorded false value therefore cannot be discarded by ordinary last-value-wins parsing and silently inherit the historical fingerprint. Escaped-equivalent keys are treated as duplicates; repeated key names in separate objects and structural characters inside quoted strings remain valid. Raw input is limited to 256 KiB and 32 container levels. Malformed JSON and local read failures produce fixed diagnostic codes rather than source excerpts or private host paths. The local companion checker is loaded inside the sanitized validation boundary: missing, malformed or failing dependencies produce `RECORD_CONNECTION_CHECKER_UNAVAILABLE`, not a raw require stack. Non-Error failures are also sanitized. The actual CLI is regression-tested for these failures as well as the valid original record.

The expected digest is a literal in reviewed code, not recomputed from the currently loaded record as its own trust anchor. A mismatch fails closed. Future observations, corrections or activation decisions need a separately reviewed versioned record; do not replace this historical fingerprint simply to force a pass. Hashes preserve the reviewed projection but do not establish the truth of an RPC response, prevent malicious modification of both code and data, or enforce an on-chain gate.

The connection checker itself remains byte-identical to the operator-run packet:

```text
ee05e43469e62e9de35ce07f96909e17f4f086eaa2f1781930912eaecdeecdc2
```

Its private report name/schema and read-only scope are preserved. No signer or mainnet-write interface is added.

## Preserved operator evidence, not newly rerun locally

The v1.5 operator rehearsal records exact compiler replay and 18 selected local-fork lifecycle/permission checks with zero transport rejections; local minting, impersonation and an agent allowlist were fixtures. The actual helper deployment records four confirmed mainnet transactions and reported exact explorer verification. Two later owner transactions and ten connected-state checks establish the recorded ENS integration at block 26,165,026. Production activation remains HOLD with five open closeout groups.

See the [instance record](../deployments/MAINNET_USDC_2026-10-10.md), [activation review](../OPERATIONS/PRODUCTION_ACTIVATION.md) and [public JSON](../../config/mainnet/agi-jobs-usdc.json) for addresses, hashes and limitations. Historical test counts are not added together and called an independent audit. No software merge or CI result authorizes intake activation.
