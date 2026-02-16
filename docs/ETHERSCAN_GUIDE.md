# AGIJobManager Etherscan Guide (Read/Write Contract)

This guide is for users who only want to use **Etherscan + wallet** (no CLI required).

## Before you start (everyone)

1. Open the deployed contract page on Etherscan.
2. Confirm the contract is **verified** so the ABI-backed forms appear under **Read Contract** and **Write Contract**.
3. Connect your wallet in **Write Contract**.

### Units you must use

- `payout`, `bond`, and token amounts are in the AGI token's **smallest units** (like wei for ETH).
  - Example: if token has 18 decimals, `1 token = 1000000000000000000`.
- `duration`, `completionReviewPeriod`, `disputeReviewPeriod`, and challenge windows are **seconds**.
  - 1 hour = `3600`
  - 1 day = `86400`

### Pre-flight checklist (always do this)

Under **Read Contract**, check:

- `paused()` must be `false` for intake actions (`createJob`, `applyForJob`).
- `settlementPaused()` must be `false` for settlement actions (`requestJobCompletion`, `validateJob`, `disapproveJob`, `finalizeJob`, `disputeJob`, moderator resolution).
- Your token balance (`balanceOf`) is enough.
- Your allowance (`allowance(owner, spender)`) is enough for AGIJobManager to pull tokens via `transferFrom`.

`spender` = AGIJobManager contract address.

---

## Choose your role

## Employer flow

### 1) Approve AGI allowance

On the AGI ERC-20 token contract (Write tab):
- `approve(spender, amount)`
  - `spender`: AGIJobManager address
  - `amount`: payout in base units

Example:
- Human: 1,200 AGI
- Base units (18 decimals): `1200000000000000000000`

### 2) Create job

On AGIJobManager (Write tab):
- `createJob(jobSpecURI, payout, duration, details)`

Example inputs:
- `jobSpecURI`: `ipfs://bafybeigdyrzt.../jobSpec.v1.json`
- `payout`: `1200000000000000000000`
- `duration`: `259200` (3 days)
- `details`: `Spanish-to-English legal translation, 40 pages`

### 3) Optional cancel (before assignment only)

- `cancelJob(jobId)`
- Reverts with `InvalidState` after an agent is assigned.

### 4) Finalize after completion request / voting windows

- `finalizeJob(jobId)`
- If validators approved early and challenge period passed, finalization can succeed before full review window.
- If review window ends with tie/under-quorum, this call can create a dispute instead of settling.

### 5) Raise dispute if needed

- `disputeJob(jobId)`
- Employer or assigned agent can call during review period after completion is requested.
- Requires dispute bond transfer (approve first if needed).

### 6) `delistJob(jobId)` meaning

- `delistJob(jobId)` is **owner-only** emergency/admin cancellation for unassigned jobs.
- Employers should normally use `cancelJob`.

### 7) Events to track in Etherscan logs

- `JobCreated` → job posted
- `JobApplied` → agent assigned
- `JobCompletionRequested` → completion submitted
- `JobDisputed` → dispute opened
- `JobCompleted` → settled agent-win path
- `JobExpired` → expired and refunded to employer

### If employer actions revert

- `NotAuthorized`: wrong caller (not employer for employer-only action).
- `InvalidState`: wrong lifecycle stage (e.g., cancel after assignment; finalize too early).
- `SettlementPaused`: settlement actions paused.
- `TransferFailed`: allowance/balance/token behavior problem.

---

## Agent flow

### Agent authorization decision tree

An agent can pass authorization if **any one** is true:

1. `additionalAgents(agentAddress) == true` (owner allowlist), or
2. Agent is in current agent Merkle root with valid proof, or
3. ENS ownership path validates for the submitted subdomain.

If none pass, `applyForJob` reverts `NotAuthorized`.

### 1) Approve AGI for agent bond (if bond > 0)

- On AGI token: `approve(AGIJobManager, amount)`.

### 2) Apply to a job

- `applyForJob(jobId, subdomain, proof)`

Examples:
- `jobId`: `42`
- `subdomain`: `alice-agent`
- `proof` (Etherscan bytes32[]):
  - `[]` (if allowlisted directly and not using Merkle)
  - `[
    "0x2b5d5b6f8c6f5f7a4fcb89de0d4045ce2f4b56e09a1ce3b7f7a1738ac9f2d103",
    "0x8f26f0de0efecf7c54a8b44e8d5f8d0617f0af6f94fd5f4d1f4f208f01877d71"
  ]`

### 3) Submit completion

- `requestJobCompletion(jobId, jobCompletionURI)`

Example:
- `jobCompletionURI`: `ipfs://bafybeibf.../jobCompletion.v1.json`

### 4) Dispute (if needed)

- `disputeJob(jobId)` during review period.

### If agent actions revert

- `NotAuthorized`: authorization path failed or wrong caller.
- `Blacklisted`: address is blacklisted.
- `IneligibleAgentPayout`: agent lacks required AGI type eligibility.
- `InvalidState`: already assigned/completed/disputed/out-of-window.
- `TransferFailed`: missing allowance or token transfer failure.

---

## Validator flow

### Validator authorization decision tree

Validator can vote if **any one** is true:

1. `additionalValidators(validatorAddress) == true`, or
2. Included in validator Merkle root with valid proof, or
3. ENS ownership path validates for submitted subdomain.

### 1) Approve AGI for validator bond

- On AGI token: `approve(AGIJobManager, amount)`.

### 2) Cast vote

- Approve outcome: `validateJob(jobId, subdomain, proof)`
- Reject outcome: `disapproveJob(jobId, subdomain, proof)`

Proof format for Etherscan:

`["0xabc...","0xdef..."]`

### 3) Practical voting checklist

Vote only when:
- `completionRequested == true`
- current time <= `completionRequestedAt + completionReviewPeriod`
- you have not already voted

Avoid voting when:
- dispute already active (`disputed == true`)
- review window passed

Gas note:
- first validator vote initializes per-job validator bond amount and may cost more gas.

### Slashing (high-level)

- Validators post a bond per vote.
- Validators on the incorrect side can be partially slashed by `validatorSlashBps`.
- Correct-side validators share reward pool + slashed amounts.

### How votes affect finalization

- Early approve path: enough approvals sets `validatorApproved`; finalize allowed after challenge period.
- At review end:
  - no votes → deterministic agent-win settlement,
  - tie or under quorum → dispute is opened,
  - majority approvals → agent-win,
  - majority disapprovals → employer refund path.

### If validator actions revert

- `NotAuthorized` / `Blacklisted` / `InvalidState` / `TransferFailed`.
- `ValidatorLimitReached` if max validators per job reached.

---

## Moderator flow

### Resolve dispute

- `resolveDisputeWithCode(jobId, resolutionCode, reason)`

`resolutionCode` values:
- `0` = log-only no-op (emits event, dispute remains active)
- `1` = resolve in favor of agent (`_completeJob` path)
- `2` = resolve in favor of employer (`_refundEmployer` path)

Reason examples:
- `"Evidence confirms milestone delivered; agent prevails"`
- `"Major spec mismatch; employer refunded"`

`reason` is emitted in `DisputeResolvedWithCode` and visible on-chain.

---

## Owner/operator flow

### Pause controls

- `pause` / `unpause` (aka intake pause helpers exist too)
- `setSettlementPaused(bool)` controls settlement actions separately.

Plain English:
- `pause=true` blocks new intake actions.
- `settlementPaused=true` blocks settlement/dispute/finalization paths.

### Treasury withdrawal (safe sequence)

1. `pause()` (required for `withdrawAGI`).
2. `withdrawableAGI()` (Read) to get max safe amount.
3. `withdrawAGI(amount)` with `amount <= withdrawableAGI`.

### Manage allowlists / roots

- `updateMerkleRoots(validatorRoot, agentRoot)`
- `addAdditionalAgent` / `removeAdditionalAgent`
- `addAdditionalValidator` / `removeAdditionalValidator`

### Moderators / blacklists

- `addModerator` / `removeModerator`
- `blacklistAgent(address, status)`
- `blacklistValidator(address, status)`

### ENS configuration

- `setEnsJobPages(address)`
- `setUseEnsJobTokenURI(bool)`
- `lockIdentityConfiguration()` (irreversible lock of identity wiring controls)

### Rescue functions (extreme caution)

- `rescueERC20(token, to, amount)`
- `rescueToken(token, data)`
- `rescueETH(amount)`

These are emergency tools; misuse can break trust with users. Use formal runbook and sign-off.

---

## Time windows and finalization timeline

```text
assignedAt -------------------- assignedAt + duration
    |                                   |
    |<----- agent can work ------------>| (after this, expire path possible if no completion request)

completionRequestedAt ---------------- completionRequestedAt + completionReviewPeriod
         |                                        |
         |<----- validators can vote ------------>| finalize may settle or open dispute

validatorApprovedAt ----- validatorApprovedAt + challengePeriodAfterApproval
         |                               |
         |<-- early finalize blocked -->| after this, early finalize can settle if approvals > disapprovals
```

### “Can I call finalize now?” checklist

1. `completionRequested == true`?
2. If `validatorApproved == true`, has `challengePeriodAfterApproval` elapsed?
3. If not early path, has `completionReviewPeriod` elapsed?
4. If tie/under-quorum, expect dispute creation on finalize.

If unsure: you can still call `finalizeJob(jobId)`; if too early, it reverts `InvalidState`.

---

## Read Contract cheat sheet

- `getJobCore(jobId)`
  - employer, assignedAgent, payout, duration, assignedAt, completed, disputed, expired, agentPayoutPct.
- `getJobValidation(jobId)`
  - completionRequested, validatorApprovals, validatorDisapprovals, completionRequestedAt, disputedAt.
- `getJobSpecURI(jobId)`
  - original job spec URI.
- `getJobCompletionURI(jobId)`
  - submitted completion URI.
- `tokenURI(tokenId)`
  - completion NFT metadata URI.

State inference examples:
- `assignedAgent == 0x000...0` and `completed == false` → unassigned/open.
- `completionRequested == true` and `disputed == false` → in validator review.
- `completed == true` → settled and NFT minted.
- `expired == true` → expired path executed.

---

## Revert/error decoding for Etherscan users

Common custom errors and likely fixes:

- `NotAuthorized`
  - Caller is wrong role or proof/ENS/allowlist authorization failed.
- `Blacklisted`
  - Address is owner-blacklisted.
- `InvalidParameters`
  - Bad input value/format (zero or too large period, invalid resolution code, invalid URI length, etc.).
- `InvalidState`
  - Right function, wrong timing/lifecycle stage.
- `SettlementPaused`
  - settlement toggled off by owner.
- `TransferFailed`
  - allowance/balance missing, or token transfer behavior incompatible.
- `ValidatorLimitReached`
  - max validators for this job already reached.
- `InsufficientWithdrawableBalance` / `InsolventEscrowBalance`
  - attempted treasury withdrawal exceeds safe withdrawable amount.

Tip: Etherscan shows custom error names only if ABI is verified and matched to deployed bytecode.

---

## Merkle proof helper (offline)

Use repo helper script (no RPC calls):

- Single address proof:
  - `node scripts/merkle/generate_merkle_proof.js --input scripts/merkle/sample_addresses.json --address 0x...`
- Full map (root + proofs for all addresses):
  - `node scripts/merkle/export_merkle_proofs.js --input scripts/merkle/sample_addresses.json --output proofs.json`

`proofs.json` output is directly copy/pasteable into Etherscan bytes32[] fields.
