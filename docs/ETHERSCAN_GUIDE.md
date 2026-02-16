# AGIJobManager Etherscan Guide (Read/Write Contract)

This guide is optimized for non-technical users using only:
- wallet (e.g., MetaMask)
- Etherscan `Read Contract` and `Write Contract`

## Choose your role
- Employer: [Employer flow](#employer-flow)
- Agent: [Agent flow](#agent-flow)
- Validator: [validator-flow](#validator-flow)
- Moderator: [Moderator flow](#moderator-flow)
- Owner/operator: [Owner/operator flow](#owneroperator-flow)

---

## Before you start

### Verification matters
Use contracts with **verified source + ABI** on Etherscan. Without this, forms are hard to use and custom errors are not decoded clearly.

### Units
- Token amounts are `uint256` base units (usually 18 decimals):
  - `1.5` tokens => `1500000000000000000`
- Time is seconds:
  - `12h` => `43200`
  - `7d` => `604800`

Use helper tools:
- `node scripts/etherscan/prepare_inputs.js --action convert --amount 1.5 --duration 7d`

### Safety checklist before any transaction
Read these first:
- `paused()`
- `settlementPaused()`
- `getJobCore(jobId)` and `getJobValidation(jobId)` for job actions
- AGI token `balanceOf(yourAddress)`
- AGI token `allowance(yourAddress, AGIJobManager)`

### Common failure modes

| Error / symptom | Likely cause | Fix |
|---|---|---|
| `NotAuthorized` | caller lacks role authorization | use additional allowlist, Merkle proof, or ENS auth route |
| `SettlementPaused` | settlement switch enabled | wait for owner unpause or use only non-settlement reads |
| `InvalidState` | wrong lifecycle stage | check `getJobCore` + timeline before retry |
| `TransferFailed` | insufficient allowance/balance or non-standard token behavior | set allowance, verify balance, use exact-transfer ERC20 |
| finalize opens dispute | tie/under-quorum outcome | moderator resolution required |

---

## Employer flow

### 1) Approve escrow pull on AGI token
Write function: `approve(spender, amount)` (on AGI ERC20)

Input meaning:
- `spender`: AGIJobManager contract address
- `amount`: payout in base units

Copy/paste example:
```text
spender: 0xYourAGIJobManager
amount: 1200000000000000000000   // 1200 tokens at 18 decimals
```

### 2) Create job
Write function: `createJob(jobSpecURI, payout, duration, details)`

Input meaning:
- `jobSpecURI`: metadata URI (ipfs/https)
- `payout`: base-unit token amount
- `duration`: seconds
- `details`: short plain text summary

Example:
```text
jobSpecURI: ipfs://bafy.../job-spec.v1.json
payout: 1200000000000000000000
duration: 259200
details: Translate legal packet EN->ES
```

### 3) Cancel if unassigned
Write function: `cancelJob(jobId)`

### 4) Finalize when eligible
Write function: `finalizeJob(jobId)`

### 5) Open dispute when needed
Write function: `disputeJob(jobId)`

---

## Agent flow

### Authorization decision tree
Use one route:
1. owner allowlist (`additionalAgents`) OR
2. Merkle proof (`agentMerkleRoot`) OR
3. ENS ownership under configured root node

### 1) Approve agent bond if required
Write function on token: `approve(spender, amount)`

### 2) Apply to job
Write function: `applyForJob(jobId, subdomain, proof)`

Input meanings:
- `jobId`: target job
- `subdomain`: ENS label used for ENS auth path (or placeholder if using allowlist/merkle)
- `proof`: bytes32[] merkle proof

Proof paste formats:
```text
[]
```
```text
["0xaaa...", "0xbbb..."]
```

### 3) Submit completion
Write function: `requestJobCompletion(jobId, jobCompletionURI)`

Example URI:
```text
ipfs://bafy.../completion.v1.json
```

### 4) Optional dispute
Write function: `disputeJob(jobId)`

---

## Validator flow

### Authorization decision tree
Use one route:
1. owner allowlist (`additionalValidators`) OR
2. Merkle proof (`validatorMerkleRoot`) OR
3. ENS ownership under configured root node

### 1) Approve validator bond
Token write function: `approve(spender, amount)`

### 2) Vote
- approve: `validateJob(jobId, subdomain, proof)`
- reject: `disapproveJob(jobId, subdomain, proof)`

Proof paste format:
```text
["0xaaa...", "0xbbb..."]
```

Outcome notes:
- wrong-side validators can be slashed
- correct-side validators can share rewards

---

## Moderator flow

Write function: `resolveDisputeWithCode(jobId, resolutionCode, reason)`

Resolution code table:
- `0` = NO_ACTION (dispute remains)
- `1` = AGENT_WIN
- `2` = EMPLOYER_WIN

Standardized reason format (recommended):
```text
EVIDENCE:v1|summary:<one line>|links:<ipfs/case refs>|policy:<section>|moderator:<id>|ts:<unix>
```

---

## Owner/operator flow

### Pause controls
- intake only: `pause()` / `unpause()`
- settlement toggle: `setSettlementPaused(true/false)`
- full stop: `pauseAll()`

### Governance/admin writes
- allowlists: `addAdditionalAgent`, `addAdditionalValidator`
- blacklists: `blacklistAgent`, `blacklistValidator`
- moderators: `addModerator`, `removeModerator`
- withdrawals: `withdrawableAGI()` (read) then `withdrawAGI(amount)`
- ENS config: `setEnsJobPages`, `setUseEnsJobTokenURI`, `updateRootNodes`, `updateMerkleRoots`
- lock identity config: `lockIdentityConfiguration()`
- rescue/break-glass: `rescueERC20`, `rescueToken` (extreme caution)

---

## Time windows

```text
assign --> request completion --> review window --> challenge window --> finalize OR dispute --> resolve
```

### Can I finalize now?
Checklist:
1. Read `getJobCore(jobId)`: `completionRequested == true`, `disputed == false`, not completed/expired/cancelled.
2. Read `getJobValidation(jobId)` for vote counters/timing parameters.
3. Compare `completionRequestedAt + completionReviewPeriod` and challenge period with current timestamp.
4. If tied/under-quorum at review end, expect dispute path.

---

## Read-contract cheat sheet

- `getJobCore(jobId)`: canonical lifecycle fields (participants, payout, timestamps, flags).
- `getJobValidation(jobId)`: review/dispute windows and vote counters/state.
- `getJobSpecURI(jobId)`: original job metadata URI.
- `getJobCompletionURI(jobId)`: submitted completion metadata URI.
- `tokenURI(tokenId)`: final NFT metadata URI after completion.

---

## Authorization details (especially for Agent/Validator)

### Route 1: owner additional allowlist
- Agent: `addAdditionalAgent(address)`
- Validator: `addAdditionalValidator(address)`

### Route 2: Merkle proof
- leaf format: `keccak256(abi.encodePacked(address))`
- proof pasted as Etherscan bytes32[]
- offline generation script:
  - `node scripts/merkle/export_merkle_proofs.js --input addresses.json`

### Route 3: ENS subdomain ownership
Subdomain label constraints:
- lowercase ASCII
- length 1..63
- `[a-z0-9-]` only
- no dots
- no leading/trailing dash

Decision tree:
```text
If owner allowlisted you -> use [] proof and proceed.
Else if you have Merkle proof -> paste bytes32[] proof.
Else if you own valid ENS subdomain under configured root -> use subdomain route.
Else -> you are not authorized yet.
```

---

## Offline helper scripts

- Merkle proofs: `node scripts/merkle/export_merkle_proofs.js --input addresses.json`
- Etherscan input prep: `node scripts/etherscan/prepare_inputs.js --action create-job --payout 1200 --duration 3d`
- Offline state advisor: `node scripts/advisor/state_advisor.js --input sample-job.json`
