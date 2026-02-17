# AGIJobManager Etherscan Guide (Read/Write Contract)

This guide is written for non-technical users who only use:
- a browser wallet (MetaMask or similar)
- Etherscan `Read Contract` and `Write Contract`

## Choose your role
- Employer: [Employer flow](#employer-flow)
- Agent: [Agent flow](#agent-flow)
- Validator: [Validator flow](#validator-flow)
- Moderator: [Moderator flow](#moderator-flow)
- Owner/operator: [Owneroperator flow](#owneroperator-flow)

---

## Before you start

### Verification matters
Use the verified AGIJobManager contract on Etherscan. Verified source + ABI gives readable field names and decoded errors/events. If source is not verified, stop and use [`docs/VERIFY_ON_ETHERSCAN.md`](VERIFY_ON_ETHERSCAN.md).

### Units
- Token amounts are `uint256` base units (usually 18 decimals).
  - `1` token = `1000000000000000000`
  - `1.5` tokens = `1500000000000000000`
- Time values are in seconds.
  - `12h` = `43200`
  - `7d` = `604800`

Use the offline helper:
```bash
node scripts/etherscan/prepare_inputs.js --action convert --amount 1.5 --duration 7d
```

### Safety checklist before any transaction
1. Read `paused()`.
2. Read `settlementPaused()`.
3. For job-specific actions, read `getJobCore(jobId)` and `getJobValidation(jobId)`.
4. On AGI token contract, read `balanceOf(yourAddress)`.
5. On AGI token contract, read `allowance(yourAddress, AGIJobManagerAddress)`.
6. Confirm all numeric inputs are base units / seconds.

### Common failure modes (custom errors)

| Error / symptom | Likely cause | Fix |
|---|---|---|
| `NotAuthorized` | caller is not owner/moderator or fails role auth | use allowlist/Merkle/ENS route or correct signer |
| `Blacklisted` | caller is blacklisted as agent/validator | contact owner/operator |
| `SettlementPaused` | settlement lane is paused | wait for owner to unpause settlement |
| `InvalidState` | action not valid in current job stage | check read cheat sheet + timeline first |
| `JobNotFound` | wrong `jobId` | verify job ID in events/read calls |
| `InvalidParameters` | malformed input (empty URI, bad code, bad config value) | correct parameters and retry |
| `TransferFailed` | balance/allowance too low or token not strict-transfer compatible | fix allowance/balance; use standard ERC20 behavior |
| `InsufficientWithdrawableBalance` | owner withdraw > `withdrawableAGI()` | lower amount |
| `InsolventEscrowBalance` | unsafe owner action while escrow backing would be harmed | wait and reconcile escrow state |
| `ConfigLocked` | identity configuration already locked | cannot change ENS/Merkle identity settings |
| Finalize opens dispute | tie/under-quorum or contested outcome at finalize time | moderator must resolve dispute |

---

## Employer flow

### 1) Approve escrow amount (AGI token contract)
Write function: `approve(spender, amount)`

Input fields:
- `spender`: AGIJobManager contract address
- `amount`: payout in base units

Example:
```text
spender: 0xYourAGIJobManager
amount: 1200000000000000000000   // 1200 AGI at 18 decimals
```

### 2) Create job
Write function: `createJob(jobSpecURI, payout, duration, details)`

Input fields:
- `jobSpecURI` (string): URI to job metadata
- `payout` (uint256): escrow amount in base units
- `duration` (uint256): seconds until expiry window
- `details` (string): human-readable summary

Example:
```text
jobSpecURI: ipfs://bafy.../job-spec.v1.json
payout: 1200000000000000000000
duration: 259200
details: Translate legal packet EN->ES
```

### 3) Cancel job (when allowed)
Write function: `cancelJob(jobId)`

Input field:
- `jobId` (uint256): target job ID

Example:
```text
jobId: 42
```

### 4) Finalize when eligible
Write function: `finalizeJob(jobId)`

Input field:
- `jobId` (uint256): target job ID

Example:
```text
jobId: 42
```

### 5) Dispute if needed
Write function: `disputeJob(jobId)`

Input field:
- `jobId` (uint256): target job ID

Example:
```text
jobId: 42
```

---

## Agent flow

### Authorization (3 routes)
1. Owner additional allowlist (`addAdditionalAgent`) OR
2. Merkle proof (`agentMerkleRoot`) OR
3. ENS subdomain ownership under configured root node

### 1) Approve bond if required (AGI token contract)
Write function: `approve(spender, amount)`

### 2) Apply to job
Write function: `applyForJob(jobId, subdomain, proof)`

Input fields:
- `jobId` (uint256): target job ID
- `subdomain` (string): ENS label for ENS auth route (no dots)
- `proof` (bytes32[]): Merkle proof array (use `[]` if not using Merkle route)

Examples:
```text
jobId: 42
subdomain: alice-agent
proof: []
```

```text
jobId: 42
subdomain: alice-agent
proof: ["0xaaa...", "0xbbb..."]
```

### 3) Request completion
Write function: `requestJobCompletion(jobId, jobCompletionURI)`

Input fields:
- `jobId` (uint256)
- `jobCompletionURI` (string): URI with deliverable evidence

Example:
```text
jobId: 42
jobCompletionURI: ipfs://bafy.../completion.v1.json
```

### 4) Dispute (optional)
Write function: `disputeJob(jobId)`

---

## Validator flow

### Authorization (3 routes)
1. Owner additional allowlist (`addAdditionalValidator`) OR
2. Merkle proof (`validatorMerkleRoot`) OR
3. ENS subdomain ownership under configured root node

### 1) Approve validator bond (AGI token contract)
Write function: `approve(spender, amount)`

### 2) Vote during review
- Approve work: `validateJob(jobId, subdomain, proof)`
- Disapprove work: `disapproveJob(jobId, subdomain, proof)`

Input fields for both vote functions:
- `jobId` (uint256)
- `subdomain` (string)
- `proof` (bytes32[])

Proof format examples:
```text
[]
```
```text
["0xaaa...", "0xbbb..."]
```

Outcome notes:
- wrong-side validators can be slashed
- correct-side validators can receive validation rewards

---

## Moderator flow

Write function: `resolveDisputeWithCode(jobId, resolutionCode, reason)`

Input fields:
- `jobId` (uint256)
- `resolutionCode` (uint8)
- `reason` (string)

Resolution code table:
- `0` = `NO_ACTION` (dispute remains unresolved)
- `1` = `AGENT_WIN`
- `2` = `EMPLOYER_WIN`

Standardized reason format:
```text
EVIDENCE:v1|summary:<one line>|facts:<facts>|links:<ipfs/urls>|policy:<section>|moderator:<id>|ts:<unix>
```

---

## Owneroperator flow

### Pause controls
- Intake pause: `pause()` / `unpause()`
- Settlement pause: `setSettlementPaused(true|false)`
- Full stop toggles: `pauseAll()` / `unpauseAll()`

### Governance/admin writes
- Allowlist: `addAdditionalAgent`, `addAdditionalValidator`
- Blacklist: `blacklistAgent`, `blacklistValidator`
- Moderator set: `addModerator`, `removeModerator`
- Withdrawals: read `withdrawableAGI()` then call `withdrawAGI(amount)`
- ENS identity settings: `setEnsJobPages`, `setUseEnsJobTokenURI`, `updateEnsRegistry`, `updateNameWrapper`, `updateRootNodes`, `updateMerkleRoots`
- Configuration lock: `lockIdentityConfiguration()`
- Rescue (extreme caution): `rescueERC20`, `rescueToken`

---

## Time windows

```text
assignedAt
  |-------------------- duration --------------------|  (in-progress window)
  |                                                   \
  |                                                    \ if no completion request and now > assignedAt + duration
  |                                                     -> expireJob path
  |
  +--> completionRequestedAt
        |------ completionReviewPeriod ------|  (validator vote window)
        |
        +--> if validator-approved branch is active:
              |-- challengePeriodAfterApproval --|

Safe finalize gate (conservative):
now > max(completionRequestedAt + completionReviewPeriod,
          validatorApprovedAt + challengePeriodAfterApproval [if applicable])
```

### Can I finalize now? checklist
1. `getJobCore(jobId)` must indicate:
   - `completed == false`
   - `disputed == false`
   - `expired == false`
2. `getJobValidation(jobId)` must indicate:
   - `completionRequested == true`
3. Calculate review end: `completionRequestedAt + completionReviewPeriod`.
4. If validator-approved path is active, also enforce challenge window elapsed.
5. Use strict elapsed logic: only act once current timestamp is **greater than** required threshold.
6. If finalization still routes to dispute, use moderator flow.

### What if nobody votes?
- Exact no-vote case (`approvals = 0`, `disapprovals = 0`): after the review window, `finalizeJob` deterministically completes in the agent-win path (no moderator action required).
- Dispute routing is for contested low-participation outcomes (for example non-zero but under-quorum votes) or ties, not for pure zero-vote finalization.

### Why can `finalizeJob` create a dispute?
`finalizeJob` is the transition function that evaluates votes, quorum, disapprovals, and timing gates together. If those checks indicate contested/insufficient consensus, it can mark dispute state instead of direct payout.

---

## Read-contract cheat sheet

Use these reads to infer state and next action:

- `getJobCore(jobId)` returns:
  - employer, assignedAgent, payout, duration, assignedAt
  - completed/disputed/expired flags
  - agentPayoutPct
- `getJobValidation(jobId)` returns:
  - completionRequested
  - validatorApprovals / validatorDisapprovals
  - completionRequestedAt / disputedAt
- `getJobSpecURI(jobId)` returns job spec URI.
- `getJobCompletionURI(jobId)` returns completion evidence URI.
- `tokenURI(tokenId)` returns NFT metadata URI (ENS-based when enabled).

Interpretation shortcuts:
- `assignedAgent == 0x000...0` => still open (not assigned).
- `completionRequested == true` => review/dispute phase started.
- `disputed == true` => only dispute resolution path remains.
- `completed == true` or `expired == true` => terminal job state.

---

## Authorization details (Agent and Validator)

### ENS label constraints
For `subdomain` input used in ENS auth route:
- lowercase ASCII only
- length 1..63
- characters allowed: `[a-z0-9-]`
- no dots (`.`)
- no leading or trailing `-`

### Which auth method are you using?
```text
Are you owner-allowlisted?
  yes -> use that wallet, proof can be []
  no  -> do you have Merkle proof from operator?
          yes -> paste proof bytes32[] into Etherscan
          no  -> do you control an allowed ENS subdomain under configured root?
                  yes -> provide subdomain label in write call
                  no  -> ask operator for allowlisting or updated Merkle root
```

### Merkle tooling
Leaf format is fixed:
- `keccak256(abi.encodePacked(address))`

Generate root + proofs offline:
```bash
node scripts/merkle/export_merkle_proofs.js --input scripts/merkle/sample_addresses.json
```

---

## Offline helper scripts (copy/paste friendly)

### A) Merkle proof export
```bash
node scripts/merkle/export_merkle_proofs.js --input scripts/merkle/sample_addresses.json --output merkle-proof-output.json
```

### B) Etherscan input prep CLI
```bash
node scripts/etherscan/prepare_inputs.js --action approve --spender 0xYourAGIJobManager --amount 1200
node scripts/etherscan/prepare_inputs.js --action create-job --payout 1200 --duration 3d --jobSpecURI ipfs://bafy.../job.json --details "Translate legal packet EN->ES"
node scripts/etherscan/prepare_inputs.js --action apply --jobId 42 --subdomain alice-agent --proof "0xaaa...,0xbbb..."
node scripts/etherscan/prepare_inputs.js --action request-completion --jobId 42 --jobCompletionURI ipfs://bafy.../completion.json
node scripts/etherscan/prepare_inputs.js --action validate --jobId 42 --subdomain val-1 --proof "[]"
node scripts/etherscan/prepare_inputs.js --action resolve-dispute --jobId 42 --code 1 --reason "EVIDENCE:v1|summary:milestones met|facts:...|links:ipfs://...|policy:ops-2.1|moderator:mod-07|ts:1736465000"
```

### C) Offline state advisor
```bash
node scripts/advisor/state_advisor.js --input scripts/advisor/sample_job_state.json
```

Expected input schema (`--input` or `--json`):
- `currentTimestamp`
- `completionReviewPeriod`
- `disputeReviewPeriod`
- `challengePeriodAfterApproval`
- `validatorApproved` (optional but recommended)
- `validatorApprovedAt` (optional but recommended)
- `getJobCore` object from Etherscan
- `getJobValidation` object from Etherscan

The advisor prints:
- derived lifecycle state
- valid actions now
- earliest safe thresholds for finalize/expire/stale-dispute resolution
