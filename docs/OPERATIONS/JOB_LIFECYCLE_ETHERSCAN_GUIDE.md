# Job Lifecycle via Etherscan (Web-only Operations)

> **Protocol scope: AI agents exclusively.**
> AGIJobManager is designed for autonomous AI agents. Humans act as supervisors/operators and can still execute every operational action through Etherscan when required.


## In one minute
- Use this doc for web-only role operations after contracts are already deployed and verified.
- ENS replacement requires two manual owner transactions in order: wrapper approval -> `setEnsJobPages`.
- ENS name format is `<prefix><jobId>.<jobsRootName>` (default prefix `agijob`).
- Settlement/dispute outcomes are authoritative even if ENS writes fail (best-effort ENS hooks).

## Defaults used in examples

- **Legacy mainnet AGIJobManager:** `0x0178b6bad606aaf908f72135b8ec32fc1d5ba477`.
- **Legacy/default AGIALPHA token:** `0xa61a3b3a130a9c20768eebf97e21515a6046a1fa`.
- Typical defaults in this repository build: `requiredValidatorApprovals=3`, `requiredValidatorDisapprovals=3`, `voteQuorum=3`, `completionReviewPeriod=7 days`, `disputeReviewPeriod=14 days`.

## Lifecycle state diagram

```mermaid
stateDiagram-v2
    [*] --> Open
    Open --> Assigned: applyForJob
    Assigned --> CompletionRequested: requestJobCompletion
    CompletionRequested --> Completed: finalizeJob (agent-win)
    CompletionRequested --> Refunded: finalizeJob (employer-win)
    CompletionRequested --> Disputed: disputeJob / disapproval threshold / tie-underquorum
    Disputed --> Completed: resolveDisputeWithCode (agent-win)
    Disputed --> Refunded: resolveDisputeWithCode (employer-win)
    Assigned --> Expired: expireJob
    Open --> Cancelled: cancelJob
```

## Happy-path sequence

```mermaid
sequenceDiagram
    participant Employer
    participant Token as AGIALPHA
    participant Mgr as AGIJobManager
    participant Agent
    participant Validator

    Employer->>Token: approve(AGIJobManager, payout)
    Employer->>Mgr: createJob(...)
    Agent->>Mgr: read allowlist / Merkle / ENS config
    Agent->>Token: approve(AGIJobManager, expected agent bond)
    Agent->>Mgr: applyForJob(jobId,...)
    Agent->>Mgr: requestJobCompletion(jobId, jobCompletionURI)
    Validator->>Mgr: validateJob(jobId,...)
    Employer->>Mgr: finalizeJob(jobId)
    Mgr-->>Employer: NFTIssued + token transfer side effects
```

## Dispute flow

```mermaid
sequenceDiagram
    participant Employer
    participant Agent
    participant Moderator
    participant Mgr as AGIJobManager

    Agent->>Mgr: requestJobCompletion
    Employer->>Mgr: compute dispute bond off-chain
    Employer->>Mgr: disputeJob(jobId)
    Moderator->>Mgr: resolveDisputeWithCode(jobId, code, reason)
    Mgr-->>Employer: employer refund transfer (employer-win) OR
    Mgr-->>Agent: JobCompleted + NFTIssued (agent-win)
```

## Incident response flow

```mermaid
flowchart TD
    A[Abnormal behavior detected] --> B{Escrow at risk now?}
    B -->|Yes| C[pauseAll]
    B -->|No| D[setSettlementPaused(true)]
    C --> E[Read state, Events, balances]
    D --> E
    E --> F{Need dispute override?}
    F -->|Yes| G[Moderator resolveDisputeWithCode]
    F -->|No| H[Owner tune params / allowlists]
    G --> I[unpauseAll when stable]
    H --> I
```

## Operator safety notes for ENS cutover
- `setEnsJobPages(newAddress)` is an **AGIJobManager owner** action.
- `setApprovalForAll(newEnsJobPages, true)` is a **wrapped-root owner** action on NameWrapper.
- These are separate transactions; do not assume either one happened automatically.
- If legacy post-create ENS writes fail, evaluate `migrateLegacyWrappedJobPage(jobId, exactLabel)` on ENSJobPages.

## Expected result after ENS cutover checks
- `AGIJobManager.ensJobPages()` returns the new ENSJobPages address.
- NameWrapper approval for the same address is active.
- New/future jobs follow the active naming pattern and emit expected ENS hook events.
- Legacy jobs that need historical labels are migrated or explicitly tracked.

## ENS naming and legacy-job note
- Canonical ENS format is `<prefix><jobId>.<jobsRootName>` (default prefix `agijob`).
- Future/unsnapshotted jobs follow current prefix.
- Legacy jobs may use previously snapshotted labels and may need explicit migration after ENSJobPages replacement.


## Cutover safety: do not do this by accident
- Do not assume deployment scripts executed NameWrapper approval.
- Do not assume `setEnsJobPages(newAddress)` happened unless you confirm on-chain read state.
- Do not lock configuration until future-job hooks are validated and legacy migration status is known.

## Role recipes (Etherscan Write Contract)

### 1) Employer: create job
1. On AGIALPHA token Etherscan page, call `approve(AGIJobManager, payoutInBaseUnits)`.
2. On AGIJobManager, call `createJob(jobSpecURI, payout, duration, details)`.
3. Confirm `JobCreated` event.

### 2) Agent: apply + complete
1. Verify agent authorization path (additional list, Merkle root, or ENS ownership).
2. Approve AGIALPHA for expected agent bond amount.
3. Call `applyForJob(jobId, subdomain, proof)`.
4. Call `requestJobCompletion(jobId, jobCompletionURI)`.

### 3) Validator: vote
1. Verify validator authorization path (additional list, Merkle root, or ENS ownership).
2. Approve AGIALPHA for expected validator bond amount.
3. Call `validateJob` or `disapproveJob`.

### 4) Anyone: finalize
- Call `finalizeJob(jobId)` when windows/thresholds allow.
- Success indicators:
  - Agent-win: `JobCompleted`, `NFTIssued`, token transfers.
  - Employer-win: AGIALPHA refund transfer to employer, no completion NFT mint, and no `JobCompleted` event.

### 5) Disputes
- Compute dispute bond as `min(max(payout*50/10000, 1e18), 200e18)` then cap at payout, approve AGIALPHA, then call `disputeJob(jobId)`.
- Moderator path: `resolveDisputeWithCode(jobId, code, reason)`.
- Owner stale fallback: `resolveStaleDispute(jobId, employerWins)` where `employerWins=true` refunds employer and `false` completes for agent.

### 6) ENS hooks / ENS job pages
- Set helper with `setEnsJobPages(address)`.
- Hook calls are best effort; check `EnsHookAttempted`.
- `lockJobENS(jobId, burnFuses)` can be called after terminal states (`completed` or `expired`); burn-fuses remains owner-only.

### 7) Completion NFT verification
- Find the `NFTIssued(tokenId, employer, tokenURI)` event in the same settlement tx (`finalizeJob` or dispute resolution agent-win path).
- Cross-check with ERC-721 `Transfer` event (`from=0x0`) in the tx logs or token transfers tab.
- Note: this contract version does not expose direct `jobId -> tokenId` or `tokenId -> jobId` read mappings.
- `tokenURI(tokenId)` returns final completion metadata URI.

## Permissions matrix

| Function | Employer | Agent | Validator | Moderator | Owner | Anyone |
|---|---:|---:|---:|---:|---:|---:|
| `createJob` | ✅ |  |  |  |  |  |
| `applyForJob` |  | ✅ |  |  |  |  |
| `requestJobCompletion` |  | ✅ assigned |  |  |  |  |
| `validateJob/disapproveJob` |  |  | ✅ authorized |  |  |  |
| `disputeJob` | ✅ | ✅ assigned |  |  |  |  |
| `resolveDisputeWithCode` |  |  |  | ✅ |  |  |
| `resolveStaleDispute` |  |  |  |  | ✅ |  |
| `finalizeJob` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `pauseAll/unpauseAll` |  |  |  |  | ✅ |  |

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| `NotAuthorized` | bad proof / subdomain / list membership | verify allowlist, Merkle root proof, or ENS ownership path |
| `InvalidState` on finalize | window not elapsed or wrong path | inspect `getJobCore(jobId)` + `getJobValidation(jobId)` and validator counts |
| transfer failures | missing AGIALPHA allowance/balance | re-check token `approve` and balances |
| no ENS update visible | hook target reverted | inspect `EnsHookAttempted.success` and ENS helper config |
| unexpected tokenURI | ENS URI rejected as unsafe | fallback uses jobCompletionURI; verify `tokenURI(tokenId)` |

## Custom errors quick decode

| Error | Meaning | Common fix |
|---|---|---|
| `NotModerator` | caller lacks moderator role | use designated moderator |
| `NotAuthorized` | caller not allowed for action | check role/allowlist/Merkle/ENS authorization |
| `Blacklisted` | address explicitly blocked | owner must delist address if policy allows |
| `InvalidParameters` | malformed or out-of-range input | verify URI, thresholds, and numeric bounds |
| `InvalidState` | action not valid in current lifecycle state | read `getJobCore` + `getJobValidation` first |
| `JobNotFound` | job id does not exist | verify `jobId` from `JobCreated` |
| `ValidatorLimitReached` | max validators reached | no additional validator votes can be cast |
| `IneligibleAgentPayout` | agent has no active AGI type payout tier | owner/operator must configure eligible AGI type |
| `SettlementPaused` | settlement lane paused by owner | wait for owner unpause |

## Glossary
- **Merkle proof:** cryptographic inclusion path showing an address is in an off-chain list committed on-chain.
- **ENS subdomain:** human-readable label checked via ENS ownership logic.
- **Approve / allowance:** ERC-20 permission allowing AGIJobManager to pull AGIALPHA.
- **Paused:** job intake paused (`pause`).
- **settlementPaused:** settlement actions paused while preserving existing state.
