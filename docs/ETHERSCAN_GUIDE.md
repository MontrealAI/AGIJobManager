# Etherscan Guide (Read/Write Contract)

This guide is designed for non-technical users who only use:
- wallet (MetaMask or similar),
- Etherscan Read/Write tabs.

## A) Before you start

### 1) Verification matters
Use this guide only on a contract with **verified source + ABI**. Without verification, Write/Read forms and errors are hard to interpret. See [`docs/VERIFY_ON_ETHERSCAN.md`](VERIFY_ON_ETHERSCAN.md).

### 2) Units and formatting
- Token amounts are `uint256` **base units**.
  - 1 token at 18 decimals = `1000000000000000000`.
- Time values are **seconds**.
  - 1 hour = `3600`
  - 1 day = `86400`
  - 7 days = `604800`

Use helper:
```bash
node scripts/etherscan/cli.js --action convert --amount 1.5 --duration 7d
```

### 3) Safety checklist before any write transaction
- Read `paused()`; if true, intake functions revert.
- Read `settlementPaused`; if true, settlement-related flows revert.
- On AGI token, check your wallet balance and allowance.
- Read `getJobCore(jobId)` and `getJobValidation(jobId)` before acting.

### 4) Common failure modes

| Revert / symptom | Likely cause | Fix |
|---|---|---|
| `NotAuthorized` | wrong auth route (allowlist / proof / ENS) | use correct route; verify proof/subdomain |
| `InvalidState` | wrong job phase or window expired | re-check `getJobCore/getJobValidation` timestamps |
| `Blacklisted` | owner blacklisted caller role | contact operator |
| `InvalidParameters` | bad URI/amount/duration/code | validate field values and units |
| `SettlementPaused` | settlement paused | wait for operator action |
| ERC20 transfer revert | low balance/allowance or non-standard token behavior | fix allowance/balance; use strict-transfer token |

---

## B) Choose your role

## Employer flow

### 1) Approve escrow amount on AGI token
Write on AGI token contract:
- function: `approve(spender, amount)`
- spender: AGIJobManager address
- amount: payout base units

Example helper:
```bash
node scripts/etherscan/cli.js --action approve --spender 0xYourManager --amount 250 --decimals 18
```

### 2) Create job
Write on AGIJobManager:
- function: `createJob(_jobSpecURI, _payout, _duration, _details)`
- `_jobSpecURI`: URL/IPFS URI
- `_payout`: base units
- `_duration`: seconds
- `_details`: plain text summary

Copy/paste example:
```text
_jobSpecURI: ipfs://bafybeigdyr.../job-spec.json
_payout: 250000000000000000000
_duration: 604800
_details: Build and test feature X
```

### 3) Cancel job (only before assignment)
- function: `cancelJob(_jobId)`
- allowed only when no assigned agent and not completed.

### 4) Finalize job
- function: `finalizeJob(_jobId)`
- if approval threshold was reached, must also wait challenge period.
- after review window:
  - 0 votes => agent-win path,
  - tie or under quorum => dispute opened,
  - approvals > disapprovals => agent-win,
  - disapprovals > approvals => employer refund.

### 5) Dispute
- function: `disputeJob(_jobId)`
- callable by employer or assigned agent, only during completion review window.

## Agent flow

### Authorization routes
You are authorized if **any one** succeeds:
1. `additionalAgents(msg.sender) == true`.
2. Valid Merkle proof against `agentMerkleRoot`.
3. ENS ownership under configured agent roots.

### Apply
- function: `applyForJob(_jobId, subdomain, proof)`
- `subdomain`: ENS label if using ENS route; otherwise can be empty string.
- `proof`: bytes32[] if Merkle route; otherwise `[]`.

`bytes32[]` formatting in Etherscan:
```text
[]
```
or
```text
["0xabc...64hex...","0xdef...64hex..."]
```

Example helper:
```bash
node scripts/etherscan/cli.js --action applyForJob --jobId 12 --subdomain agent-label --proof '["0x1111...","0x2222..."]'
```

### Request completion
- function: `requestJobCompletion(_jobId, _jobCompletionURI)`
- only assigned agent.

### Optional dispute
- function: `disputeJob(_jobId)`.

## Validator flow

### Authorization routes
Same pattern as agent but uses validator routes:
1. `additionalValidators(msg.sender)`.
2. Merkle proof for `validatorMerkleRoot`.
3. ENS ownership under validator roots.

### Vote approve/disapprove
- `validateJob(_jobId, subdomain, proof)`
- `disapproveJob(_jobId, subdomain, proof)`

Outcome meaning:
- correct-side validators share rewards/slashed pool,
- incorrect-side validators are partially slashed.

## Moderator flow

### Resolve dispute with code
- function: `resolveDisputeWithCode(_jobId, resolutionCode, reason)`

Code table:
- `0` = no-op (event only; dispute remains active)
- `1` = settle in agent-win path
- `2` = refund employer path

Reason format (recommended):
```text
CASE:<id>|EVIDENCE:<short refs>|RULE:<policy-id>|OUTCOME:<code>|NOTE:<free text>
```

Example:
```text
CASE:42|EVIDENCE:chatlog#9,deliveryHash|RULE:MOD-1|OUTCOME:1|NOTE:milestone met
```

## Owner/operator flow (high-risk)

Use [`docs/OWNER_RUNBOOK.md`](OWNER_RUNBOOK.md). Primary actions:
- Pauses: `pause/unpause`, `setSettlementPaused`, `pauseAll/unpauseAll`
- Governance: moderators, additional allowlists, blacklists
- Parameters: quorum/thresholds/windows/bonds/slash/limits
- Treasury: `withdrawAGI` (while paused, solvency checked by `withdrawableAGI`)
- ENS config + lock: `setEnsJobPages`, `setUseEnsJobTokenURI`, roots, `lockIdentityConfiguration`
- Rescue: `rescueETH`, `rescueERC20`, `rescueToken` (**extreme caution**)

---

## C) Time windows (ASCII timeline)

```text
assignment
  |
  |---- duration ----|   (agent must request completion before expiry, unless disputed)
  v
completionRequestedAt
  |
  |---- completionReviewPeriod ----|  validators vote / either party may dispute
  v
review end
  |
  | finalizeJob:
  |   - if clear majority + quorum => settle
  |   - tie/under quorum => dispute
  |   - no votes => deterministic agent-win path
  v
if disputed: disputedAt
  |
  |---- disputeReviewPeriod ----|  moderator resolution expected
  v
owner may resolve stale dispute
```

### “Can I finalize now?” checklist
- `completionRequested == true` from `getJobValidation`.
- job is not `completed/expired/disputed` from `getJobCore`.
- if `validatorApproved` path already triggered, challenge window must have elapsed.
- otherwise, `now > completionRequestedAt + completionReviewPeriod`.

If finalize reverts `InvalidState`, re-read timing fields and try again later.

---

## D) Read-contract cheat sheet

- `getJobCore(jobId)`:
  - employer, assignedAgent, payout, duration, assignedAt, completed, disputed, expired, agentPayoutPct.
- `getJobValidation(jobId)`:
  - completionRequested, approvals, disapprovals, completionRequestedAt, disputedAt.
- `getJobSpecURI(jobId)`:
  - spec URI submitted at create.
- `getJobCompletionURI(jobId)`:
  - completion URI submitted by agent.
- `tokenURI(tokenId)`:
  - completion NFT metadata URI (optionally ENS-backed depending on config).

Use these to infer state before every write.

---

## E) Authorization decision tree

```text
Are you owner-added? (additionalAgents/additionalValidators)
  ├─ Yes -> pass proof [] and proceed
  └─ No
      Are you on Merkle allowlist with proof?
        ├─ Yes -> pass proof bytes32[] and proceed
        └─ No
            Use ENS route:
              - provide owned subdomain label
              - proof can be []
```

ENS subdomain label constraints:
- lowercase ASCII only,
- length 1..63,
- chars `[a-z0-9-]` only,
- no dots,
- cannot start/end with `-`.

---

## Offline helper tools

### Merkle root + proofs (Etherscan-ready)
```bash
node scripts/merkle/export_merkle_proofs.js --input scripts/merkle/sample_addresses.json
```

### Paste-ready Etherscan payloads
```bash
node scripts/etherscan/cli.js --action createJob --amount 100 --duration 7d --jobSpecURI ipfs://spec --details "Milestone 1"
```

### Offline state advisor (no RPC)
```bash
node scripts/advisor/job_state_advisor.js '{"nowTs":1730000000,"jobCore":{"assignedAgent":"0x1111111111111111111111111111111111111111","duration":604800,"assignedAt":1729000000,"completed":false,"disputed":false,"expired":false},"jobValidation":{"completionRequested":true,"validatorApprovals":2,"validatorDisapprovals":1,"completionRequestedAt":1729500000,"disputedAt":0},"config":{"completionReviewPeriod":604800,"disputeReviewPeriod":1209600,"voteQuorum":3}}'
```
