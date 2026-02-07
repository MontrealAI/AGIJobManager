# AGIJobManager Contract Documentation

This document provides a comprehensive, code‑accurate overview of the `AGIJobManager` contract. It is intended for engineers, integrators, reviewers, and operators. The ABI‑exact reference lives in [`AGIJobManager_Interface.md`](AGIJobManager_Interface.md).

## High‑level overview

**What AGIJobManager is**
- An on‑chain **job escrow manager** where employers fund jobs in ERC‑20, agents perform work, validators approve/disapprove completion, and moderators resolve disputes.
- A **reputation tracker** for agents and validators, awarding points based on payout and completion time (with diminishing returns).
- An **ERC‑721 job NFT issuer**: when a job completes, the employer receives an NFT that points to the completion metadata URI.
- A **role‑gated system** that enforces access via explicit allowlists, Merkle proofs, and ENS/NameWrapper/Resolver ownership checks.

**What AGIJobManager is not**
- Not an on‑chain ERC‑8004 registry or identity system.
- Not a generalized NFT marketplace; there are **no** `listNFT`/`purchaseNFT` functions in this contract.
- Not a decentralized court or DAO (moderators and owner are privileged).

## Key components

- **Jobs**: funded by employers, assigned to a single agent, validated by a bounded set of validators, optionally disputed and resolved by moderators.
- **Agents**: apply for jobs if allowlisted/Merkle/ENS‑verified and not blacklisted. Agent payout is snapshotted at assignment time based on AGIType NFT holdings. Agents post a performance bond at apply time.
- **Validators**: approve/disapprove job completion if allowlisted/Merkle/ENS‑verified and not blacklisted. Validators post a bond per vote and are rewarded/slashed based on the final outcome.
- **Moderators**: resolve disputes using typed resolution codes.
- **Dispute bonds**: the disputant posts a bond that is paid to the winning side on resolution.
- **NFT issuance**: on completion, a job NFT is minted to the employer.
- **Reputation**: updated on completion for agents and validators; reputation grows with payout size and timeliness, capped by diminishing returns.

## Roles & permissions (overview)

- **Owner**: pause/unpause; manage moderators, allowlists, and blacklists; update parameters; add AGI types; update ENS/Merkle wiring before lock; withdraw surplus ERC‑20; resolve stale disputes.
- **Moderator**: resolve disputes (agent‑win or employer‑win) with typed codes.
- **Employer**: creates jobs; can cancel jobs before assignment; can dispute; receives job NFTs; receives refunds if a job expires or if dispute resolution favors the employer.
- **Agent**: applies for jobs (eligibility gated) and requests completion; receives payouts and reputation on successful completion; posts agent bond.
- **Validator**: validates or disapproves completion requests; posts bond; receives payout share and reputation if included.

A complete, per‑function access matrix is in the interface reference: [`AGIJobManager_Interface.md`](AGIJobManager_Interface.md).

## Job lifecycle (state machine)

```mermaid
stateDiagram-v2
    [*] --> Open: createJob
    Open --> InProgress: applyForJob
    InProgress --> CompletionRequested: requestJobCompletion

    CompletionRequested --> ValidatorApproved: validateJob (approvals >= requiredValidatorApprovals)
    ValidatorApproved --> CompletionEligible: challengePeriodAfterApproval elapsed
    CompletionEligible --> Completed: finalizeJob (approvals > disapprovals)

    CompletionRequested --> Disputed: disapproveJob (disapprovals >= requiredValidatorDisapprovals)
    CompletionRequested --> Disputed: disputeJob (manual)

    CompletionRequested --> FinalizationWindow: completionReviewPeriod elapsed
    FinalizationWindow --> Completed: finalizeJob (approvals > disapprovals)
    FinalizationWindow --> Disputed: finalizeJob (quorum not met or tie)
    FinalizationWindow --> Completed: finalizeJob (no votes -> agent wins, no reputation)
    FinalizationWindow --> Completed: finalizeJob (employer wins)

    Disputed --> Completed: resolveDisputeWithCode(AGENT_WIN)
    Disputed --> Completed: resolveDisputeWithCode(EMPLOYER_WIN)
    Disputed --> Completed: resolveStaleDispute (owner, timeout)

    InProgress --> Expired: expireJob (duration elapsed, no completion request)

    Open --> Deleted: cancelJob (employer)
    Open --> Deleted: delistJob (owner)
```

**State flags / counters**
- `assignedAgent`, `assignedAt`: set on `applyForJob`.
- `completionRequested`, `completionRequestedAt`, `jobCompletionURI`: set on `requestJobCompletion`.
- `validatorApprovals`, `validatorDisapprovals`, `validators[]`: updated on `validateJob`/`disapproveJob`.
- `validatorApproved`, `validatorApprovedAt`: set when approvals reach `requiredValidatorApprovals`.
- `disputed`, `disputedAt`, `disputeInitiator`, `disputeBondAmount`: set by `disputeJob` or when disapproval threshold is reached.
- `completed`, `escrowReleased`: set when settlement completes.
- `expired`: set by `expireJob` when duration has passed without a completion request.

## Events (audit‑focused map)

| Event | Emitted on | Notes |
| --- | --- | --- |
| `JobCreated` | `createJob` | Emits job spec URI, payout, duration, and details. |
| `JobApplied` | `applyForJob` | Records assigned agent. |
| `JobCompletionRequested` | `requestJobCompletion` | Records completion metadata URI. |
| `JobValidated` | `validateJob` | One event per validator approval. |
| `JobDisapproved` | `disapproveJob` | One event per validator disapproval. |
| `JobDisputed` | `disputeJob` / disapproval threshold | Dispute opened. |
| `DisputeResolved` | `_resolveDispute` | Legacy string‑based resolution event. |
| `DisputeResolvedWithCode` | `_resolveDispute` | Canonical dispute resolution event. |
| `JobCompleted` | `_completeJob` | Completion anchor; also emits `ReputationUpdated` per recipient. |
| `ReputationUpdated` | `enforceReputationGrowth` | Fired for agent and validators when payouts complete. |
| `JobCancelled` | `cancelJob`/`delistJob` | Cancellation (employer) or owner delist of open job. |
| `JobExpired` | `expireJob` | Expired without completion request. |
| `EnsRegistryUpdated` / `NameWrapperUpdated` | owner updates | ENS wiring updates (before lock). |
| `RootNodesUpdated` / `MerkleRootsUpdated` | owner updates | Identity allowlist updates. |
| `AGITypeUpdated` | `addAGIType` | Payout percentage per AGI type NFT. |
| `NFTIssued` | `_mintCompletionNFT` | ERC‑721 minted to employer. |
| `RewardPoolContribution` | `contributeToRewardPool` | Additional reward pool contributions. |
| `CompletionReviewPeriodUpdated` / `DisputeReviewPeriodUpdated` | owner updates | Review period changes. |
| `AdditionalAgentPayoutPercentageUpdated` | owner update | Stored config value (not used in payouts). |
| `ValidatorBondParamsUpdated` | `setValidatorBondParams` | Validator bond parameter changes. |
| `ChallengePeriodAfterApprovalUpdated` | `setChallengePeriodAfterApproval` | Validator approval challenge window updates. |
| `AGIWithdrawn` | `withdrawAGI` | Withdraws only surplus over locked balances. |
| `IdentityConfigurationLocked` | `lockIdentityConfiguration` | One‑way lock for ENS/token wiring. |
| `AgentBlacklisted` / `ValidatorBlacklisted` | owner updates | Eligibility gating. |

## Error handling (custom errors + typical causes)

The contract uses custom errors for gas‑efficient reverts. Common triggers:

| Error | Typical causes |
| --- | --- |
| `NotModerator` | Non‑moderator calls dispute resolution. |
| `NotAuthorized` | Wrong actor for a role‑gated action; invalid ENS/Merkle ownership. |
| `Blacklisted` | Agent/validator is blacklisted. |
| `InvalidParameters` | Zero/invalid payout, duration, URI, percentages, or parameter bounds. |
| `InvalidState` | Action not permitted in current lifecycle state. |
| `JobNotFound` | Job ID is not initialized or was deleted. |
| `TransferFailed` | ERC‑20 transfer/transferFrom failed or returned false or amount mismatch. |
| `ValidatorLimitReached` | Validator cap reached for a job. |
| `InvalidValidatorThresholds` | Approval/disapproval thresholds exceed caps. |
| `IneligibleAgentPayout` | Agent has 0% payout tier at apply time. |
| `InsufficientWithdrawableBalance` | Withdrawal exceeds `withdrawableAGI()`. |
| `InsolventEscrowBalance` | Contract balance < locked totals. |
| `ConfigLocked` | Identity configuration already locked. |

## Core invariants (implementation expectations)

- **Escrow accounting**: `lockedEscrow` tracks total job escrow; withdrawals are limited to `balance - lockedEscrow - lockedAgentBonds - lockedValidatorBonds - lockedDisputeBonds`.
- **Completion gating**: payout + NFT mint require a valid, non‑empty completion URI submitted via `requestJobCompletion`.
- **Role gating**: agents/validators must pass allowlist/Merkle/ENS checks (or be in `additional*` allowlists) and not be blacklisted.
- **Single‑settlement**: a job can be completed, expired, or deleted once; settlement functions guard against double‑finalization.
- **Validator bounds**: approvals/disapprovals must remain within `MAX_VALIDATORS_PER_JOB` or settlement becomes unreachable.

## Token & escrow semantics

- **Funding**: `createJob` transfers the job payout into the contract and increments `lockedEscrow`.
- **Agent bond**: `applyForJob` transfers the agent bond into the contract and increments `lockedAgentBonds`. On agent win the bond is returned to the agent; on employer win the bond is refunded to the employer (or pooled for validators if disapproval threshold was reached).
- **Validator bond**: each validator vote transfers a bond (computed from `validatorBondBps`, `validatorBondMin`, `validatorBondMax`) and increments `lockedValidatorBonds`. Correct validators earn rewards; incorrect validators are slashed by `validatorSlashBps`.
- **Dispute bond**: `disputeJob` transfers a bond based on `DISPUTE_BOND_BPS` with min/max caps. The bond is paid to the winner on resolution.
- **Agent payout**: on completion, the agent receives `job.payout * agentPayoutPct / 100`, where `agentPayoutPct` is snapshotted on `applyForJob` based on the highest `AGIType` NFT percentage the agent holds.
- **Validator payout**: on completion, **correct‑side** validators split `job.payout * validationRewardPercentage / 100` plus any pooled bond amounts, **only if** there is at least one validator. Incorrect validators receive their bond minus the slashed portion, and if no validators participate the validator budget is returned to the employer.
- **Refunds**:
  - `cancelJob`/`delistJob` return the full escrow to the employer if no agent was assigned.
  - `expireJob` returns escrow after duration ends with no completion request and slashes the agent bond to the employer.
  - Employer‑win dispute resolution or finalization returns escrow to the employer and settles validator/agent bonds.
- **No‑vote liveness**: after `completionReviewPeriod` with zero votes, `finalizeJob` settles in favor of the agent **without** reputation updates (`repEligible = false`).
- **ERC‑20 safety**: the contract checks `transfer`/`transferFrom` return values and enforces **exact transfer amounts** (balances must increase by exactly `amount`), so fee‑on‑transfer tokens will revert.

## ENS / NameWrapper / Merkle ownership verification

Eligibility checks for agents and validators use the internal `_verifyOwnership*` functions, which accept:
- **Merkle proof**: leaf = `keccak256(abi.encodePacked(claimant))`, checked against `agentMerkleRoot` or `validatorMerkleRoot`.
- **ENS NameWrapper ownership**: `nameWrapper.ownerOf(uint256(subnode))` must equal `claimant`.
- **ENS Resolver ownership**: resolve `ens.resolver(subnode)` then call `resolver.addr(subnode)` and compare to `claimant`.

**Root nodes**
- `agentRootNode` and `clubRootNode` are the ENS root nodes for agents and validators respectively.
- `alphaAgentRootNode` and `alphaClubRootNode` are secondary roots that are also accepted.
- `_verifyOwnershipByRoot` returns false if the provided root is `bytes32(0)`.

**Merkle root selection**
- Agents use `agentMerkleRoot`; validators use `validatorMerkleRoot`. The root chosen depends on which verification function is called.

**Events**
- This contract does **not** emit a `RecoveryInitiated` or `OwnershipVerified` event; ownership verification is purely internal.

## NFT issuance and (non‑)marketplace

- **Minting**: `NFTIssued` is emitted during `_completeJob`, minting a job NFT to the employer with `tokenURI = baseIpfsUrl + "/" + jobCompletionURI` unless the completion URI is already a full URI.
- **Marketplace**: there are **no** `listNFT`/`purchaseNFT`/`delistNFT` functions in the ABI; job NFTs are standard ERC‑721 tokens intended to trade externally via approvals/transfers.

## dApp integration tips

1. **Employer**: approve ERC‑20 → call `createJob`.
2. **Agent**: prove eligibility → `applyForJob` (posts agent bond).
3. **Agent**: submit completion metadata → `requestJobCompletion`.
4. **Validators**: approve/disapprove → `validateJob` / `disapproveJob` (posts validator bonds).
5. **Moderator** (if disputed): settle → `resolveDisputeWithCode`.
6. **Anyone**: after review windows, `finalizeJob` can settle a job if not disputed.
7. **Employer**: receive job NFT on completion (track `NFTIssued`).

For detailed call sequences, revert conditions, and events, see [`AGIJobManager_Interface.md`](AGIJobManager_Interface.md).

## Quickstart examples (Truffle + web3)

> These snippets assume a Truffle environment (`truffle exec` or test context) and that `agiToken` is a standard ERC‑20 with `approve`/`transferFrom`.

### Approve ERC‑20 then create a job (employer)

```javascript
const agi = await IERC20.at(agiTokenAddress);
const mgr = await AGIJobManager.at(agiJobManagerAddress);

const payout = web3.utils.toWei('100', 'ether');
const duration = 7 * 24 * 60 * 60;
await agi.approve(mgr.address, payout, { from: employer });
await mgr.createJob('ipfs://job-spec', payout, duration, 'details', { from: employer });
```

### Apply for a job (agent)

```javascript
const jobId = 0;
const subdomain = 'alice';
const proof = []; // Merkle proof if required; empty if using explicit allowlist
await mgr.applyForJob(jobId, subdomain, proof, { from: agent });
```

### Request completion (agent)

```javascript
await mgr.requestJobCompletion(jobId, 'ipfs://job-completion', { from: agent });
```

### Validate job (validator)

```javascript
const validatorProof = [];
await mgr.validateJob(jobId, 'validator', validatorProof, { from: validator });
```

### Dispute + moderator resolve

```javascript
await mgr.disputeJob(jobId, { from: employer });
// AGENT_WIN = 1, EMPLOYER_WIN = 2
await mgr.resolveDisputeWithCode(jobId, 1, 'work accepted', { from: moderator });
```

### Finalize after review window (anyone)

```javascript
await mgr.finalizeJob(jobId, { from: anyCaller });
```

### Event subscriptions

```javascript
mgr.JobCreated({}).on('data', (ev) => console.log('JobCreated', ev.returnValues));
mgr.JobCompleted({}).on('data', (ev) => console.log('JobCompleted', ev.returnValues));
mgr.JobDisputed({}).on('data', (ev) => console.log('JobDisputed', ev.returnValues));
mgr.DisputeResolvedWithCode({}).on('data', (ev) => console.log('DisputeResolved', ev.returnValues));
```
