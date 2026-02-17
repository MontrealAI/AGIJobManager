# AGIJobManager Etherscan Guide (Read/Write Contract)

This guide is for non-technical users operating only with:
- a browser wallet (MetaMask or equivalent)
- Etherscan `Read Contract` / `Write Contract`

---

## Before you start

### 1) Verification matters
Use a **verified AGIJobManager contract** and verified AGI token contract on Etherscan. Verified ABI is required for readable input forms and meaningful custom-error decoding.

### 2) Units (copy/paste ready)
- Token amounts are integer base units (`uint256`).
  - Example: `1` token at 18 decimals = `1000000000000000000`
  - Example: `250.5` tokens at 18 decimals = `250500000000000000000`
- Durations are seconds (`uint256`).
  - `1h` = `3600`
  - `7d` = `604800`

Helper converter (offline):
```bash
node scripts/etherscan/prepare_inputs.js --action convert --amount 250.5 --duration 7d --decimals 18
```

### 3) Safety checklist before any Write transaction
1. Read `paused()`.
2. Read `settlementPaused()`.
3. For job actions, read `getJobCore(jobId)` and `getJobValidation(jobId)` first.
4. On AGI token contract, read your `balanceOf` and `allowance(yourAddress, AGIJobManager)`.
5. Confirm every amount is base units and every duration is seconds.

### 4) Common failure modes

| Error/symptom | Typical cause | What to do |
|---|---|---|
| `NotAuthorized` | Caller is not owner/moderator or not authorized Agent/Validator | Use the right account; verify allowlist/Merkle/ENS authorization path |
| `Blacklisted` | Address is blacklisted | Owner/moderator must resolve operational policy issue |
| `SettlementPaused` | Settlement lane is paused | Wait for owner to unpause settlement |
| `InvalidState` | Action called at wrong lifecycle stage or wrong timestamp window | Re-check `getJobCore` + `getJobValidation` + timeline below |
| `InvalidParameters` | malformed URI, out-of-range numeric inputs, or invalid resolution code | Re-check field formatting and bounds |
| `TransferFailed` | AGI balance/allowance too low or non-standard ERC20 behavior | Set exact allowance, ensure sufficient balance, use strict-transfer token |
| finalize leads to dispute path | Review ended with tie/under-quorum conditions | Call `disputeJob` / moderator resolution flow |

---

## Choose your role

- [Employer flow](#employer-flow)
- [Agent flow](#agent-flow)
- [Validator flow](#validator-flow)
- [Moderator flow](#moderator-flow)
- [Owner/operator flow](#owneroperator-flow)

---

## Employer flow

### A) Approve escrow amount (AGI token contract)
Write function: `approve(spender, amount)`

- `spender`: AGIJobManager address
- `amount`: base units

```text
spender: 0xAGIJobManagerAddress
amount: 1200000000000000000000
```
(= 1200 tokens at 18 decimals)

### B) Create job
Write function: `createJob(jobSpecURI, payout, duration, details)`

- `jobSpecURI` (string): URI to spec JSON
- `payout` (uint256): base units
- `duration` (uint256): seconds
- `details` (string): short summary

```text
jobSpecURI: ipfs://bafy.../jobSpec.v1.json
payout: 1200000000000000000000
duration: 259200
details: Translate legal packet EN->FR
```

### C) Cancel (only when unassigned)
Write function: `cancelJob(jobId)`

```text
jobId: 42
```

### D) Finalize (when eligible)
Write function: `finalizeJob(jobId)`

```text
jobId: 42
```

### E) Dispute (if needed)
Write function: `disputeJob(jobId)`

```text
jobId: 42
```

---

## Agent flow

### How authorization works
Before applying, you must pass one of the 3 authorization routes in [Authorization decision tree](#authorization-decision-tree-agentvalidator).

### A) Approve bond if required (AGI token)
Write function: `approve(spender, amount)`

### B) Apply
Write function: `applyForJob(jobId, subdomain, proof)`

- `jobId` (uint256): target job
- `subdomain` (string): ENS label (or placeholder if using non-ENS route)
- `proof` (bytes32[]): Merkle proof, JSON-like format

```text
jobId: 42
subdomain: alice-agent
proof: ["0xabc...", "0xdef..."]
```

### C) Request completion
Write function: `requestJobCompletion(jobId, jobCompletionURI)`

```text
jobId: 42
jobCompletionURI: ipfs://bafy.../completion.v1.json
```

### D) Dispute if needed
Write function: `disputeJob(jobId)`

---

## Validator flow

### How authorization works
Same 3-route authorization model as Agent.

### A) Approve validator bond if required
AGI token `approve(spender, amount)`.

### B) Vote
- Approve path: `validateJob(jobId, subdomain, proof)`
- Disapprove path: `disapproveJob(jobId, subdomain, proof)`

```text
jobId: 42
subdomain: validator-ops
proof: ["0x111...", "0x222..."]
```

Outcome reminder: wrong-side validators can be slashed; reward distribution depends on final settlement branch.

---

## Moderator flow

Write function: `resolveDisputeWithCode(jobId, resolutionCode, reason)`

Resolution code table:
- `0` = NO_ACTION (dispute remains active)
- `1` = AGENT_WIN
- `2` = EMPLOYER_WIN

Standard reason format:
```text
EVIDENCE:v1|summary:<one-line>|facts:<facts>|links:<uris>|policy:<section>|moderator:<id>|ts:<unix>
```

Example:
```text
jobId: 42
resolutionCode: 1
reason: EVIDENCE:v1|summary:deliverable matched scope|facts:spec hash + acceptance logs|links:ipfs://...|policy:mod-2.1|moderator:mod-07|ts:1736465000
```

---

## Owner/operator flow

Use extreme caution. Prioritize checklist-driven operations from [`docs/OWNER_RUNBOOK.md`](OWNER_RUNBOOK.md).

Key functions:
- pause controls: `pause`, `unpause`, `pauseAll`, `unpauseAll`, `setSettlementPaused`
- allowlists: `addAdditionalAgent`, `removeAdditionalAgent`, `addAdditionalValidator`, `removeAdditionalValidator`
- blacklists: `blacklistAgent`, `blacklistValidator`
- moderators: `addModerator`, `removeModerator`
- treasury: `withdrawableAGI` (read), `withdrawAGI`
- ENS/config: `setEnsJobPages`, `setUseEnsJobTokenURI`, `updateEnsRegistry`, `updateNameWrapper`, `updateRootNodes`, `updateMerkleRoots`, `lockIdentityConfiguration`
- rescue: `rescueETH`, `rescueERC20`, `rescueToken`

---

## Time windows (ASCII timeline)

```text
assign
  |
  | (duration)
  v
requestJobCompletion
  |
  |---- completionReviewPeriod ----|
  |                                v
  |                        review closes
  |                                |
  |      (if validator-approved branch applies)
  |---- challengePeriodAfterApproval ----|
  |                                      v
  +-------------------------------> finalizeJob OR disputeJob
                                            |
                                            v
                                 resolveDisputeWithCode / resolveStaleDispute
```

### “Can I finalize now?” checklist
1. Read `getJobCore(jobId)`: must be completion-requested flow, not already settled/cancelled/expired branch.
2. Read `getJobValidation(jobId)`.
3. Compare current wall-clock timestamp to:
   - `completionRequestedAt + completionReviewPeriod`
   - `validatorApprovedAt + challengePeriodAfterApproval` (when applicable)
4. If `finalizeJob` reverts with `InvalidState`, re-check windows and whether dispute is active.

---

## Read Contract cheat sheet

- `getJobCore(jobId)`:
  - participants (`employer`, `assignedAgent`)
  - economic/timing (`payout`, `duration`, `assignedAt`)
  - lifecycle flags (`completed`, `disputed`, `expired`)
- `getJobValidation(jobId)`:
  - `completionRequested`
  - vote counts (`validatorApprovals`, `validatorDisapprovals`)
  - timing anchors (`completionRequestedAt`, `disputedAt`)
- `getJobSpecURI(jobId)`: source-of-truth job scope URI.
- `getJobCompletionURI(jobId)`: completion evidence URI.
- `tokenURI(tokenId)`: completion NFT metadata URI (subject to configured URI behavior).

---

## Authorization (Agent/Validator)

### 3 authorization routes
1. Owner-granted mapping
   - Agents: `additionalAgents[address]`
   - Validators: `additionalValidators[address]`
2. Merkle proof allowlist
   - leaves use `keccak256(abi.encodePacked(address))`
   - proof is pasted in Etherscan as bytes32[]
3. ENS subdomain ownership under configured root node(s)

### ENS label constraints
For `subdomain` strings used in ENS auth route:
- lowercase ASCII only
- length `1..63`
- characters `[a-z0-9-]`
- **no dots (`.`)**
- no leading/trailing `-`

### Authorization decision tree (Agent/Validator)

```text
Do you have owner additional* entry?
  yes -> use subdomain placeholder + proof []
  no  -> Do you have Merkle proof for current root?
           yes -> paste proof bytes32[]
           no  -> Do you own valid ENS subdomain under configured root?
                    yes -> pass subdomain label + proof []
                    no  -> request authorization before transacting
```

---

## Offline helper tools (no RPC required)

### Merkle proofs
```bash
node scripts/merkle/export_merkle_proofs.js --input scripts/merkle/sample_addresses.json
```

### Etherscan input prep
```bash
node scripts/etherscan/prepare_inputs.js --action create-job --payout 1200 --duration 3d --jobSpecURI ipfs://... --details "Translate packet"
```

### Offline job state advisor
```bash
node scripts/advisor/state_advisor.js --input ./job_state.json
```
`job_state.json` should contain pasted outputs from `getJobCore` + `getJobValidation` and `currentTimestamp`.
