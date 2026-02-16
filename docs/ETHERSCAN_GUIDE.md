# AGIJobManager Etherscan Guide (Read/Write Contract)

This guide is for non-technical users operating from Etherscan only.

## A) Before you start

### Verification matters

Use the verified contract page. Without verified source/ABI, Etherscan forms and revert decoding are hard to use safely.

### Units and formatting

- Token amounts are base units (usually 18 decimals).
  - `1 AGI` => `1000000000000000000`
  - `1200 AGI` => `1200000000000000000000`
- Time values are seconds.
  - `7 days` => `604800`
  - `12h` => `43200`
- `bytes32` values are hex strings like `0xabc...` (64 hex chars after `0x`).
- `bytes32[]` values in Etherscan are JSON-like arrays:

```text
[
  "0x2b5d...d103",
  "0x8f26...7d71"
]
```

Use helper scripts:
- `node scripts/merkle/export_merkle_proofs.js --input allowlist.json`
- `node scripts/etherscan/prepare_inputs.js --action <...>`

### Pre-flight safety checklist (every transaction)

Read before writing:
1. `paused()`
2. `settlementPaused()`
3. `getJobCore(jobId)`
4. `getJobValidation(jobId)`
5. AGI token `balanceOf(yourAddress)`
6. AGI token `allowance(yourAddress, AGIJobManager)`

### Common failure modes

| Revert / symptom | Likely cause | Fix |
|---|---|---|
| `SettlementPaused` | Settlement gate is on | Wait for owner to call `setSettlementPaused(false)` |
| `Pausable: paused` | Intake pause is on | Wait for owner `unpause()` |
| `NotAuthorized` | Wrong caller/role/proof/subdomain | Use correct role address or proof/ENS route |
| `InvalidState` | Action not valid in current lifecycle window | Re-check `getJobCore/getJobValidation` timestamps and flags |
| `Blacklisted` | Address blacklisted by owner | Contact operator |
| `TransferFailed` | allowance/balance or non-standard token behavior | Increase allowance/balance; AGI token must support strict transfers |
| `InvalidParameters` | malformed URI, bad amounts, invalid resolution code | Correct inputs and retry |

---

## B) Core role flows (choose your role)

## Employer

### 1) Approve escrow
- Contract: AGI token
- Write: `approve(spender, amount)`

Example:
- spender: `0xAGIJobManager...`
- human amount: `1200 AGI`
- base units: `1200000000000000000000`

### 2) Create job
- Write: `createJob(jobSpecURI, payout, duration, details)`

Field meanings:
- `jobSpecURI`: URI to requirements (IPFS/HTTPS)
- `payout`: AGI base units
- `duration`: seconds from assignment until expiry eligibility
- `details`: short human-readable summary

Copy/paste example:
```text
jobSpecURI: ipfs://bafy.../jobSpec.v1.json
payout: 1200000000000000000000
duration: 604800
details: Translate contract package EN->FR
```

### 3) Cancel if still unassigned
- Write: `cancelJob(jobId)`
- Works only before agent assignment.

### 4) Finalize when eligible
- Write: `finalizeJob(jobId)`
- May settle, refund, or open dispute depending on votes/quorum.

### 5) Open dispute when needed
- Write: `disputeJob(jobId)`
- Allowed for employer/assigned agent during completion review window.
- Dispute bond is pulled from caller (`approve` first if needed).

## Agent

### Authorization route (must pass one)
1. `additionalAgents(msg.sender) == true`
2. valid Merkle proof under `agentMerkleRoot`
3. ENS subdomain ownership under configured root nodes

### 1) Approve bond (if required)
- AGI token `approve(AGIJobManager, amount)`

### 2) Apply
- Write: `applyForJob(jobId, subdomain, proof)`

Copy/paste examples:
```text
jobId: 42
subdomain: alice-agent
proof: []
```
or
```text
proof: ["0x2b5d...d103","0x8f26...7d71"]
```

### 3) Request completion
- Write: `requestJobCompletion(jobId, jobCompletionURI)`

Example:
```text
jobId: 42
jobCompletionURI: ipfs://bafy.../completion.v1.json
```

### 4) Dispute (if necessary)
- Write: `disputeJob(jobId)` within review window.

## Validator

### Authorization route (must pass one)
1. `additionalValidators(msg.sender) == true`
2. valid Merkle proof under `validatorMerkleRoot`
3. ENS subdomain ownership under configured validator root

### Vote actions
- Approve path: `validateJob(jobId, subdomain, proof)`
- Reject path: `disapproveJob(jobId, subdomain, proof)`

Outcomes:
- Correct-side validators receive bond back + reward share (+ potential reputation gain).
- Incorrect-side validators are slashed by `validatorSlashBps`.

## Moderator

### Resolve active dispute
- Write: `resolveDisputeWithCode(jobId, code, reason)`

Resolution code table:
- `0` = keep dispute open (log-only no settlement)
- `1` = agent wins (complete job)
- `2` = employer wins (refund path)

Reason format (recommended):
```text
case:<id>|evidence:<hash_or_uri>|finding:<one_line>|policy:<version>|moderator:<handle>
```

## Owner / operator

Use with extreme caution:
- Intake pause: `pause()` / `unpause()`
- Settlement gate: `setSettlementPaused(bool)`
- Allowlists / roots: `addAdditional*`, `removeAdditional*`, `updateMerkleRoots`
- Blacklists: `blacklistAgent`, `blacklistValidator`
- Moderators: `addModerator`, `removeModerator`
- Treasury: `withdrawableAGI()` then `withdrawAGI(amount)` (only while paused)
- ENS configuration: `setEnsJobPages`, `setUseEnsJobTokenURI`, `updateRootNodes`, `lockIdentityConfiguration`
- Rescue: `rescueERC20`, `rescueToken`, `rescueETH`

---

## C) Time windows + timeline

```text
Assigned
  |
  |--(agent works until assignedAt + duration)---------------------------
  |
Completion requested (completionRequestedAt)
  |
  |-- completionReviewPeriod --> voting/dispute window ------------------|
  |                                                                      |
  |------------------------ challengePeriodAfterApproval ---------------->| (if early approvals threshold reached)
  |
After review window:
  - no votes => finalize settles agent-win path
  - under quorum or tie => finalize opens dispute
  - approvals > disapprovals => finalize settles agent-win
  - disapprovals > approvals => finalize refunds employer

Disputed
  |-- moderator resolveDisputeWithCode anytime while active
  |-- owner resolveStaleDispute after disputedAt + disputeReviewPeriod
```

### “Can I finalize now?” checklist

1. `getJobValidation(jobId).completionRequested` is true.
2. `getJobCore(jobId).completed == false`, `expired == false`, `disputed == false`.
3. If early-approved path is used: now > `validatorApprovedAt + challengePeriodAfterApproval`.
4. Otherwise now > `completionRequestedAt + completionReviewPeriod`.
5. `settlementPaused == false`.

If a revert occurs, treat it as a state signal: re-read job core/validation values and retry only when window conditions are met.

---

## D) Read-contract cheat sheet

- `getJobCore(jobId)` -> employer, assigned agent, payout, duration, assignedAt, completed/disputed/expired, agent payout snapshot.
- `getJobValidation(jobId)` -> completionRequested, approvals, disapprovals, completionRequestedAt, disputedAt.
- `getJobSpecURI(jobId)` -> original spec URI.
- `getJobCompletionURI(jobId)` -> completion artifact URI if submitted.
- `tokenURI(tokenId)` -> completion NFT metadata URI (ENS path optional if enabled).

Use these together to infer state before every write.

---

## E) Authorization deep dive

Agent/validator authorization succeeds if **any** route passes:
1. Owner direct allowlist (`additionalAgents` / `additionalValidators`)
2. Merkle proof (`bytes32[] proof`) with leaf `keccak256(abi.encodePacked(address))`
3. ENS subdomain ownership under configured root nodes

ENS label constraints for `subdomain`:
- lowercase ASCII only
- length `1..63`
- allowed chars: `[a-z0-9-]`
- no dots
- no leading/trailing dash

Decision tree:
```text
Are you directly allowlisted?
  yes -> use proof [] and optional subdomain
  no  -> Do you have Merkle proof?
          yes -> paste bytes32[] proof
          no  -> Do you own valid ENS subdomain under configured root?
                   yes -> pass subdomain
                   no  -> cannot authorize yet
```


## Offline helper: state advisor (no RPC)

Create a JSON file with values copied from Read Contract outputs:

```json
{
  "nowTs": 1730000000,
  "completionReviewPeriod": 604800,
  "challengePeriodAfterApproval": 86400,
  "disputeReviewPeriod": 1209600,
  "voteQuorum": 3,
  "getJobCore": {
    "assignedAgent": "0x1111111111111111111111111111111111111111",
    "duration": 259200,
    "assignedAt": 1729800000,
    "completed": false,
    "disputed": false,
    "expired": false
  },
  "getJobValidation": {
    "completionRequested": true,
    "validatorApprovals": 2,
    "validatorDisapprovals": 1,
    "completionRequestedAt": 1729900000,
    "disputedAt": 0
  },
  "validatorApprovedAt": 1729910000
}
```

Run:
`node scripts/advisor/job_state_advisor.js --input state.json`

The script prints likely current state, valid actions now, and earliest safe times for finalize/expire/stale-dispute resolution.
