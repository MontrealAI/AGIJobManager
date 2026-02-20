# MODERATOR RUNBOOK

Goal: consistent dispute outcomes with minimal subjective drift.

## 1) Dispute triage decision tree

1. Read `getJobCore(jobId)`.
   - If `disputed == false`: stop (nothing to resolve).
2. Read `getJobValidation(jobId)`.
3. Read `getJobSpecURI(jobId)` and `getJobCompletionURI(jobId)`.
4. Gather minimum evidence package (below).
5. Map facts to resolution matrix.
6. Execute `resolveDisputeWithCode(jobId, code, reason)` once.

## 2) Minimum evidence checklist (required)

- Job spec URI payload/version.
- Completion URI payload/version.
- Any validator rationale snapshots.
- Timestamp context (request, votes, dispute moment).
- Confirmed wallet identities (employer, assigned agent, moderators).

No resolution without all mandatory artifacts.

## 3) Resolution matrix

| Condition | Resolution code | Outcome |
|---|---:|---|
| evidence supports completed deliverable and no disqualifying breach | `1` | agent wins |
| evidence supports non-delivery/material breach | `2` | employer wins |
| insufficient evidence / process hold required | `0` | no-op, dispute remains active |

## 4) SOP for `resolveDisputeWithCode`

Write function:
`resolveDisputeWithCode(jobId, resolutionCode, reason)`

Reason format (standardized):
```text
EVIDENCE:v1|job:<id>|code:<0|1|2>|summary:<one-line finding>|links:<uri1,uri2>|moderator:<0xaddr>|ts:<unix>
```

Examples:
```text
EVIDENCE:v1|job:42|code:1|summary:All acceptance criteria met|links:ipfs://bafy...|moderator:0x1234...|ts:1735689600
EVIDENCE:v1|job:77|code:2|summary:Critical deliverable missing|links:ipfs://bafy...|moderator:0xabcd...|ts:1735689600
```

Consistency rules:
- same facts -> same code,
- avoid freeform emotional language,
- include at least one immutable evidence URI.


Offline prep (recommended before writing):
```bash
node scripts/etherscan/prepare_inputs.js --action resolve-dispute --jobId 42 --code 1 --reason "EVIDENCE:v1|job:42|code:1|summary:All acceptance criteria met|links:ipfs://bafy...|moderator:0x1234...|ts:1735689600"
```

## 5) Etherscan-only workflow

1. In **Read Contract**: `getJobCore`, `getJobValidation`, `getJobSpecURI`, `getJobCompletionURI`.
2. Verify you are an active moderator (`moderators(yourAddress) == true`).
3. In **Write Contract** call `resolveDisputeWithCode` with standardized reason.
4. Confirm emitted `DisputeResolvedWithCode` event and archive tx hash.
5. Store one-line disposition note in your moderator log: `jobId -> code -> reason hash`.
