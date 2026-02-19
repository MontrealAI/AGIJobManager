# AGIJobManager Etherscan Guide (Read/Write Contract)

Use this guide if you only have:
- a browser wallet (MetaMask, Rabby, etc.)
- Etherscan verified contract pages

## Choose your role
- [Employer](#employer-flow)
- [Agent](#agent-flow)
- [Validator](#validator-flow)
- [Moderator](#moderator-flow)
- [Owner / operator](#owneroperator-flow)

---

## A) Before you start

### Verification matters
You need verified source + ABI on Etherscan for human-readable forms and decoded custom errors. If verification is missing, follow [`docs/VERIFY_ON_ETHERSCAN.md`](VERIFY_ON_ETHERSCAN.md) first.

### Units and conversions
- Token amounts are base units (`uint256`).
  - `1 AGI` at 18 decimals -> `1000000000000000000`
  - `1.5 AGI` -> `1500000000000000000`
- Time values are seconds.
  - `12h` -> `43200`
  - `7d` -> `604800`

Offline converter:
```bash
node scripts/etherscan/prepare_inputs.js --action convert --amount 1.5 --duration 7d
```

### Safety checklist before any write tx
1. Read `paused()`.
2. Read `settlementPaused()`.
3. For job actions, read `getJobCore(jobId)` and `getJobValidation(jobId)`.
4. On AGI ERC20 contract, read `balanceOf(yourAddress)`.
5. On AGI ERC20 contract, read `allowance(yourAddress, AGIJobManagerAddress)`.
6. Confirm all `uint256` values are base units/seconds.

### Common failure modes

| Error/symptom | Likely cause | Fix |
|---|---|---|
| `NotAuthorized` | caller not role-authorized | use correct signer, proof, or ENS label route |
| `Blacklisted` | caller is blacklisted | owner must remove blacklist |
| `SettlementPaused` | settlement lane paused | wait for owner unpause |
| `InvalidState` | wrong lifecycle phase/time window | re-check timeline + read-contract data |
| `JobNotFound` | wrong job ID | verify event/read output |
| `InvalidParameters` | malformed URI/code/config | fix inputs |
| `TransferFailed` | insufficient balance/allowance or unsupported token transfer behavior | fix balance/allowance; use strict ERC20 |
| `InsufficientWithdrawableBalance` | owner withdrawal too large | use `withdrawableAGI()` bound |
| `InsolventEscrowBalance` | owner action would violate escrow solvency | reduce action amount |
| `ConfigLocked` | identity config already locked | cannot change identity config |
| `finalizeJob` opens dispute | validator outcomes/quorum unresolved | moderator resolution path is required |

### Etherscan input formatting
- `bytes32`: `0x` + 64 hex chars.
- `bytes32[]`: JSON-like array, e.g. `[]` or `["0xaaa...","0xbbb..."]`.
- `string`: plain text (no wrapping quotes in field box).
- `uint256`: base-10 integer only.

---

## B) Core role flows

## Employer flow

### 1) Approve escrow (AGI token contract)
Write: `approve(spender, amount)`

```text
spender: 0xAGIJobManagerAddress
amount: 1200000000000000000000   // 1200 AGI @ 18 decimals
```

### 2) Create job
Write: `createJob(jobSpecURI, payout, duration, details)`
- `jobSpecURI`: metadata URI
- `payout`: base units
- `duration`: seconds
- `details`: plain-language summary

```text
jobSpecURI: ipfs://bafy.../job-spec.v1.json
payout: 1200000000000000000000
duration: 259200
details: Translate legal packet EN->ES
```

### 3) Cancel job (only when allowed)
Write: `cancelJob(jobId)`

### 4) Finalize after windows
Write: `finalizeJob(jobId)`

### 5) Dispute when needed
Write: `disputeJob(jobId)`

## Agent flow

### Authorization routes (pick one)
1) owner additional allowlist (`addAdditionalAgent`), or
2) Merkle proof route (agent root), or
3) ENS subdomain ownership route.

### 1) Apply to job
Write: `applyForJob(jobId, subdomain, proof)`

- Merkle route example:
```text
jobId: 42
subdomain:
proof: ["0x111...","0x222..."]
```
- ENS route example:
```text
jobId: 42
subdomain: alice-agent
proof: []
```

### 2) Bond approval (if required by current params)
Write on AGI token: `approve(spender, amount)`.

### 3) Request completion
Write: `requestJobCompletion(jobId, jobCompletionURI)`

```text
jobId: 42
jobCompletionURI: ipfs://bafy.../completion.json
```

### 4) Optional dispute
Write: `disputeJob(jobId)` if still inside review window.

## Validator flow

### Authorization routes
1) owner additional allowlist (`addAdditionalValidator`), or
2) Merkle proof route (validator root), or
3) ENS subdomain ownership route.

### 1) Bond approval (if required)
Write on AGI token: `approve(spender, amount)`.

### 2) Vote approve
Write: `validateJob(jobId, subdomain, proof)`

### 3) Vote disapprove
Write: `disapproveJob(jobId, subdomain, proof)`

Outcomes can trigger:
- direct completion,
- dispute opening,
- validator slashing/reward settlement at final resolution.

## Moderator flow

Write: `resolveDisputeWithCode(jobId, resolutionCode, reason)`

Resolution code table:
- `0`: no-op bookkeeping (keeps dispute active)
- `1`: agent wins
- `2`: employer wins

Standardized reason format (recommended):
```text
EVIDENCE:v1|job:42|code:1|summary:Delivered spec v1|links:ipfs://...|moderator:0x...|ts:1735689600
```

## Owner/operator flow

Use with extreme caution:
- intake/settlement controls: `pause`, `unpause`, `pauseAll`, `unpauseAll`, `setSettlementPaused`
- role governance: `addAdditionalAgent`, `removeAdditionalAgent`, `addAdditionalValidator`, `removeAdditionalValidator`, `blacklistAgent`, `blacklistValidator`, `addModerator`, `removeModerator`
- risk params: quorum, approval/disapproval thresholds, review/challenge periods, bond/slash values
- withdrawals: `withdrawableAGI`, `withdrawAGI`
- ENS/identity config: `updateEnsRegistry`, `updateNameWrapper`, `updateRootNodes`, `setEnsJobPages`, `setUseEnsJobTokenURI`, `updateMerkleRoots`, `lockIdentityConfiguration`
- rescue paths: `rescueERC20`, `rescueToken`

---

## C) Time windows (ASCII timeline)

```text
assignment (assignedAt)
   |
   |--- agent works ---|
   |                   v
   |          requestJobCompletion()
   |                   |
   |<---- completionReviewPeriod ---->|  validators vote/dispute allowed
   |                                   v
   |                            review window end
   |                                   |
   |<-- challengePeriodAfterApproval -->| (only if validator-approved path active)
   |                                   v
   |                           finalizeJob() eligible
   |                                   |
   |                        (if contested) dispute open
   |                                   |
   |<------ disputeReviewPeriod ------>| owner stale-dispute fallback after this
```

### “Can I finalize now?” checklist
- `settlementPaused() == false`
- `getJobValidation(jobId).completionRequested == true`
- `getJobCore(jobId).disputed == false`
- now > `getJobValidation(jobId).completionRequestedAt + completionReviewPeriod`
- note: `validatorApproved` / `validatorApprovedAt` are not exposed by read getters; challenge-gated finalize checks may still revert and require conservative retry timing
- if revert still occurs, re-read `getJobValidation(jobId)` approvals/disapprovals and retry later

---

## D) Read-contract cheat sheet

Use these reads before any write:

- `getJobCore(jobId)` for ownership, assignment, payout/duration/assignedAt, and completed/disputed/expired flags.
- `getJobValidation(jobId)` for `completionRequested`, approvals/disapprovals, `completionRequestedAt`, and `disputedAt`.
- `challengePeriodAfterApproval` exists, but `validatorApproved`/`validatorApprovedAt` are not returned by public getters; use conservative timing and expect possible `InvalidState` until challenge gates have elapsed.
- `getJobSpecURI(jobId)` to confirm expected job payload.
- `getJobCompletionURI(jobId)` to verify submitted completion evidence.
- `tokenURI(tokenId)` for NFT metadata URI (base or ENS job pages path, depending on configuration).

---

## E) Authorization decision tree

### ENS label constraints
For ENS route, `subdomain` must be:
- lowercase ASCII,
- 1..63 chars,
- `[a-z0-9-]` only,
- no dots,
- no leading/trailing dash.

### Which route are you using?
1. **Owner allowlist route?**
   - If your address is in `additionalAgents`/`additionalValidators`, set `proof = []`.
2. **Merkle route?**
   - Paste `bytes32[]` proof from `scripts/merkle/export_merkle_proofs.js`; subdomain can be empty.
3. **ENS route?**
   - Provide valid label in `subdomain`; usually `proof = []`.

Helper commands:
```bash
node scripts/merkle/export_merkle_proofs.js --input scripts/merkle/sample_addresses.json --output proofs.json
node scripts/etherscan/prepare_inputs.js --action apply --route merkle --jobId 42 --proof '["0x...","0x..."]'
node scripts/advisor/state_advisor.js --input scripts/advisor/sample_job_state.json
```
