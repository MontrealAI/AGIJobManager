# Parameter safety & stuck-funds analysis (operations checklist)

This document is a production-grade **operator checklist** for preventing and recovering from stuck funds or uncompletable jobs in `AGIJobManager`. It complements the main contract spec and focuses on **parameter safety**, **state-machine escape hatches**, and **operational invariants** tied directly to `contracts/AGIJobManager.sol`.

> **Scope note:** This checklist treats misconfiguration, role gating, and ERC‑20 behavior as the primary operational risks. It does **not** change contract logic or economic rules.

## Lifecycle and settlement paths (full state machine trace)

**Core job lifecycle:**
1. **Create** → `createJob` (escrow funded).
2. **Assign** → `applyForJob` (agent assigned).
3. **Completion request (optional)** → `requestJobCompletion` (agent signals completion; must be within duration).
4. **Validate / Disapprove** → `validateJob` / `disapproveJob` (validator gated; thresholds trigger completion or dispute).
5. **Complete** → `_completeJob` (payouts, reputation, NFT issuance).
6. **Cancel / Delist** → `cancelJob` (employer, only if unassigned) or `delistJob` (owner, only if unassigned).

**Dispute paths:**
- `disputeJob` by employer or agent → `resolveDisputeWithCode` by moderator.
- Resolution codes:
  - `NO_ACTION (0)` → log only; dispute remains active.
  - `AGENT_WIN (1)` → `_completeJob`.
  - `EMPLOYER_WIN (2)` → refund employer and mark completed.

**Marketplace paths (job NFTs):**
- Minted on completion in `_completeJob` (ERC‑721 `Job` token).
- `listNFT` → `purchaseNFT` → `delistNFT` (seller-controlled listing lifecycle).

## Parameter safety table (all configurable parameters and operational levers)

| Parameter / lever | Type / units | Used in | Safe range / constraints | What breaks if wrong | Recovery / escape hatch |
| --- | --- | --- | --- | --- | --- |
| `agiToken` (`updateAGITokenAddress`) | ERC‑20 address | Escrow deposits, payouts, marketplace purchases, reward pool, `withdrawAGI`. | **Treat as immutable after any job is funded.** Must be a standard ERC‑20 (no fee-on-transfer, no rebasing). | If changed after funding, escrow in the old token becomes **unrecoverable**; new payouts can revert due to missing balance. | **No on-chain recovery** for old token escrow; redeploy + off-chain remediation. |
| `requiredValidatorApprovals` (`setRequiredValidatorApprovals`) | uint256 count | `validateJob` threshold → `_completeJob`. | `0..MAX_VALIDATORS_PER_JOB`, with `approvals + disapprovals <= MAX_VALIDATORS_PER_JOB`. Operationally keep ≤ active validator count. | Too high → completion unreachable; jobs stall unless a moderator resolves disputes. | Lower threshold or add validators with `addAdditionalValidator`. |
| `requiredValidatorDisapprovals` (`setRequiredValidatorDisapprovals`) | uint256 count | `disapproveJob` threshold → dispute. | `0..MAX_VALIDATORS_PER_JOB`, with `approvals + disapprovals <= MAX_VALIDATORS_PER_JOB`. Keep low to enable disputes. | Too high → disputes never trigger; jobs can remain in limbo. | Lower threshold; use `disputeJob` + `resolveDisputeWithCode`. |
| `validationRewardPercentage` (`setValidationRewardPercentage`) | uint256 percentage | Validator payout pool in `_completeJob`. | `1..100` on-chain; **enforced with** `maxAgentPayoutPercentage + validationRewardPercentage <= 100`. | If sum exceeds 100, payouts can exceed escrow → completion reverts. | Reduce `validationRewardPercentage` or reduce any AGI type payout percentage. |
| `additionalAgentPayoutPercentage` (`setAdditionalAgentPayoutPercentage`) | uint256 percentage | **Legacy** parameter retained for compatibility; no longer used to determine payouts. | `1..100` on-chain; **enforced with** `additionalAgentPayoutPercentage + validationRewardPercentage <= 100`. | Misconfiguration has no effect on payouts, but the setter can still revert if it violates the validation reward headroom check. | Avoid relying on this value; use AGI type payouts instead. |
| `maxJobPayout` (`setMaxJobPayout`) | token amount | `createJob` cap; affects reputation math. | > 0; keep to realistic exposure to avoid overflow in reputation math. | Too low → `createJob` reverts. Too high → reputation math overflow (Solidity 0.8 revert) or huge escrow risk. | Set to realistic cap; redeploy if overflow prevents completion. |
| `jobDurationLimit` (`setJobDurationLimit`) | seconds | `createJob` cap; `requestJobCompletion` deadline. | > 0; align with SLA. | Too low → `createJob` reverts or `requestJobCompletion` fails; too high → long-running stuck jobs. | Update limit; use disputes if deadline already missed. |
| `completionReviewPeriod` (`setCompletionReviewPeriod`) | seconds | Review window after `requestJobCompletion` before `finalizeJob` can settle with deterministic fallback rules. | `1..365 days` | Hours to days (24h–7d) to give employers/validators time to act. | Too short → silent/low-vote finalization may occur before review; too long → payouts stay locked longer. | Adjust window; monitor completion requests. |
| `disputeReviewPeriod` (`setDisputeReviewPeriod`) | seconds | Window before `resolveStaleDispute` is allowed (paused + owner only). | `1..365 days` | Days to weeks (7d–30d) to give moderators time to resolve. | Too short → owner can settle too early in incidents; too long → disputes can deadlock. | Adjust window; maintain moderator redundancy. |
| `premiumReputationThreshold` (`setPremiumReputationThreshold`) | points | `canAccessPremiumFeature`. | Any non-negative uint. | Mis-set only affects premium access (no settlement impact). | Adjust threshold. |
| `AGIType.payoutPercentage` (`addAGIType`) | uint256 percentage | Agent payout percentage in `_completeJob`. | `1..100`; **highest** payout across AGI types must satisfy `maxAgentPayoutPercentage + validationRewardPercentage <= 100` (enforced). | If any agent holds a high-percentage NFT that pushes the sum > 100, completion can revert. | Lower AGI type percentage (or validation reward %); re-validate. |
| `pause` / `unpause` | bool | Gates most job actions. | Use `pause` for incident response, not normal ops. | If paused, job lifecycle actions revert (creation, apply, validate, dispute, completion request). | Unpause after fixing parameters; no funds lost. |
| `addAdditionalAgent` / `addAdditionalValidator` | allowlist | Eligibility bypass. | Only use for emergency recovery or vetted identities. | Overuse weakens gating; underuse when Merkle/ENS config is wrong can stall jobs. | Add temporary allowlist entries; remove later. |
| `blacklistedAgents` / `blacklistedValidators` | bool | Eligibility gating. | Use sparingly with documented reasons. | If critical participants are blacklisted, jobs cannot progress (validate/apply revert). | Un-blacklist or resolve by moderator. |
| `addModerator` / `removeModerator` | address | Dispute resolution authority. | Ensure ≥1 active moderator. | If no moderator exists, disputes can’t resolve → funds stuck. | Add a moderator (owner action). |
| `resolveDisputeWithCode` action | uint8 code | Dispute settlement path. | `0 (NO_ACTION)`, `1 (AGENT_WIN)`, `2 (EMPLOYER_WIN)`. | Using `NO_ACTION` logs a reason but keeps the dispute active. | Moderator re-calls with the correct action code. |
| `clubRootNode`, `agentRootNode` (`updateRootNodes`) | ENS namehash | Eligibility gating. | Must match intended ENS hierarchy. Only set **before any job exists** and **before `lockConfiguration()`**. | Wrong root nodes → `_verifyOwnership` fails → validators/agents cannot qualify. | Use `additional*` allowlist pre‑lock or redeploy if pervasive. |
| `validatorMerkleRoot`, `agentMerkleRoot` (`setValidatorMerkleRoot`, `setAgentMerkleRoot`) | Merkle root | Eligibility gating. | Must match allowlists; Merkle roots are allowlist-only (no payout impact). | Bad root means Merkle proofs always fail; gating relies solely on ENS or allowlist. | Update roots or use `additional*` allowlist. |
| `ens`, `nameWrapper` (`updateENSRegistry`, `updateNameWrapper`) | contract address | ENS/NameWrapper ownership checks. | Must be correct chain-specific addresses. Only set **before any job exists** and **before `lockConfiguration()`**. | Wrong addresses → ownership checks fail; `_verifyOwnership` emits recovery events and returns false. | Use `additional*` allowlist pre‑lock or redeploy. |
| `withdrawAGI` | token amount | Owner withdraws surplus (`withdrawableAGI()`) while paused. | Only withdraw when paused and `withdrawableAGI()` is positive. | Withdrawal reverts if amount exceeds surplus. | Use `withdrawableAGI()` to size withdrawals; do not rely on raw balance. |
| `baseIpfsUrl` (`setBaseIpfsUrl`) | string URL | Token URI for job NFTs. | Stable HTTP/IPFS base. | Wrong value breaks NFT metadata display (no settlement impact). | Update base URL; metadata reads fixed retroactively. |
| `termsAndConditionsIpfsHash`, `contactEmail`, `additionalText1/2/3` | strings | UI/legal metadata only. | Non-empty strings recommended. | Mis-set affects UI/legal metadata only. | Update strings. |
| `listNFT` price | token amount | Marketplace list price. | Must be > 0. | Zero price reverts listing; invalid price prevents sale. | Re-list with valid price. |
| `purchaseNFT` allowance/balance | token amount | Marketplace purchase path. | Buyer must approve and hold `agiToken` balance. | Purchase reverts; listing stays active. | Buyer increases allowance/balance; seller can `delistNFT`. |

## Stuck-funds scenarios (prerequisites + escape hatch)

1. **Token address changed after escrow exists**
   - **Prerequisite:** `updateAGITokenAddress` called after jobs funded.
   - **Failure:** payouts/refunds revert; old-token escrow is unrecoverable.
   - **Escape hatch:** none on-chain; **redeploy** and coordinate off-chain remediation.

2. **Validator + agent payout exceeds escrow**
   - **Prerequisite:** `validationRewardPercentage + maxAgentPayoutPercentage > 100` (blocked by setters, but still guarded at settlement).
   - **Failure:** `_completeJob` reverts before payouts.
   - **Escape hatch:** lower validation reward or AGI type payout; re-validate.

3. **Validator thresholds unreachable**
   - **Prerequisite:** thresholds > available validator count, or validator gating fails (bad Merkle/ENS config).
   - **Failure:** no completion, no disputes.
   - **Escape hatch:** lower thresholds, add validators via `addAdditionalValidator`, or moderator resolves disputes.

4. **Owner attempts to withdraw escrow**
   - **Prerequisite:** `withdrawAGI` called while jobs outstanding (and paused).
   - **Failure:** Withdrawal reverts with `InsufficientWithdrawableBalance`.
   - **Escape hatch:** use `withdrawableAGI()` to withdraw surplus only.

5. **Token transfer failures (blacklist / frozen ERC‑20)**
   - **Prerequisite:** ERC‑20 reverts on `transfer` / `transferFrom` for a recipient.
   - **Failure:** settlement reverts during payouts or purchases.
   - **Escape hatch:** resolve disputes in favor of a recipient that can receive tokens, or redeploy with a compatible token.

6. **No active moderators**
   - **Prerequisite:** moderators removed or never set.
   - **Failure:** disputes cannot resolve; jobs stuck in `disputed` state.
   - **Escape hatch:** owner adds a moderator.

7. **Legacy dispute resolved with a non-settlement string**
   - **Prerequisite:** moderator calls the deprecated `resolveDispute` with any string other than `"agent win"` or `"employer win"`.
   - **Failure:** dispute remains active; no payout/refund occurs.
   - **Escape hatch:** moderator re‑resolves with `resolveDisputeWithCode` and the correct action code.

8. **Stale NFT listings**
   - **Prerequisite:** seller transfers NFT away after listing.
   - **Failure:** `purchaseNFT` reverts because seller is no longer owner; listing remains active.
   - **Escape hatch:** seller (current owner) delists and re-lists; buyers retry after listing is valid.

9. **Silent or low-vote completion request**
   - **Prerequisite:** agent called `requestJobCompletion`, but validators do not reach thresholds.
   - **Failure:** job remains incomplete, escrow locked.
   - **Escape hatch:** after `completionReviewPeriod`, anyone can call `finalizeJob`. Silence defaults to agent payout; otherwise approvals must exceed disapprovals for agent payout (ties refund the employer).

10. **Expired assignment (agent disappears)**
   - **Prerequisite:** agent assigned but never requests completion.
   - **Failure:** escrow locked beyond deadline.
   - **Escape hatch:** anyone can call `expireJob` after `assignedAt + duration` (only if completion was never requested).

11. **Dispute deadlock (no moderators)**
   - **Prerequisite:** job remains disputed without moderator action.
   - **Failure:** escrow locked indefinitely.
   - **Escape hatch:** owner pauses and calls `resolveStaleDispute` after `disputeReviewPeriod` to settle.

## Recovery playbook (step-by-step)

1. **Pause operations (owner, always available):**
   - Call `pause()` to stop new job actions while you diagnose.

2. **Diagnose root cause:**
   - Read current parameters (`requiredValidatorApprovals`, `requiredValidatorDisapprovals`, `validationRewardPercentage`, `maxJobPayout`, `jobDurationLimit`, `completionReviewPeriod`, `disputeReviewPeriod`, `agiToken`, roots, ENS/NameWrapper addresses).
   - Check current escrow balance against total outstanding job payouts.

3. **Apply fixes (owner/moderator, always available if owner keys are live):**
   - Adjust validator thresholds.
   - Reduce validation reward % or AGI type payout %.
   - Add emergency validators/agents with `addAdditionalValidator` / `addAdditionalAgent`.
   - Add a moderator if disputes are stuck.
   - Adjust `completionReviewPeriod` or `disputeReviewPeriod` if timeouts are misaligned.
   - **Never** change `agiToken` if outstanding jobs exist.

4. **Unstick jobs (path depends on job state; always available if the correct role exists):**
   - **Unassigned jobs:** employer uses `cancelJob`; owner uses `delistJob` for recovery.
   - **Assigned but incomplete:** validators retry `validateJob` or `disapproveJob`; after the deadline, anyone may `expireJob` if no completion request was made.
   - **Completion requested but stalled:** after `completionReviewPeriod`, anyone may `finalizeJob` to settle deterministically (silence → agent; approvals must exceed disapprovals, ties refund).
   - **Disputed jobs:** moderator calls `resolveDisputeWithCode` with the correct action code.
   - **Disputed + no moderators:** owner pauses and uses `resolveStaleDispute` after `disputeReviewPeriod`.

5. **Verify recovery:**
   - Query `jobs(jobId)` and `getJobStatus(jobId)` to confirm `completed` and `disputed` flags.
   - Inspect emitted events (`JobCompleted`, `DisputeResolvedWithCode`, `DisputeResolved`, `NFTIssued`) and updated balances.

## Common reasons settlement reverts (errors → explanation → fix)

| Error / condition | Where it occurs | Explanation | Suggested fix |
| --- | --- | --- | --- |
| `Pausable: paused` | Most lifecycle actions | Contract is paused by owner. | Unpause once parameters are safe. |
| `InvalidParameters` | `createJob`, `setValidationRewardPercentage`, `addAGIType`, `withdrawAGI`, `listNFT`, `contributeToRewardPool` | Input out of allowed bounds (e.g., zero payout, duration > limit, invalid percentage, zero price). | Provide valid values; check `maxJobPayout` and `jobDurationLimit`. |
| `InvalidState` | Job actions, disputes, listings | Job not in expected lifecycle state (e.g., already completed, already assigned, listing inactive). | Read `jobs(jobId)` to confirm state; retry appropriate action. |
| `NotAuthorized` | Role-gated paths | Caller lacks role/ownership (agent not assigned, validator not allowlisted, seller not NFT owner). | Verify role gating, allowlists, and ownership; add via owner if needed. |
| `NotModerator` | `resolveDisputeWithCode` | Caller is not a moderator. | Owner must add moderator; then re-resolve. |
| `Blacklisted` | `applyForJob`, `validateJob`, `disapproveJob` | Agent/validator is blocked. | Remove blacklist entry or use another participant. |
| `TransferFailed` | Any ERC‑20 transfer | Token transfer/transferFrom failed (token paused, blacklisted, or incompatible). | Use a compatible ERC‑20; ensure approvals and balances. |
| `ValidatorLimitReached` / `ValidatorSetTooLarge` | `validateJob`, `disapproveJob`, `_completeJob` | More than `MAX_VALIDATORS_PER_JOB` (50) validators attempted. | Keep validators per job ≤ 50; set thresholds well below 50. |
| `InvalidValidatorThresholds` | `setRequiredValidatorApprovals` / `setRequiredValidatorDisapprovals` | Approvals + disapprovals exceed 50, or individual > 50. | Reconfigure thresholds within limits. |
| `JobNotFound` | Any job access | Job ID not created or deleted. | Use `nextJobId` bounds to identify valid IDs. |
| `InsufficientWithdrawableBalance` | `withdrawAGI` | Withdrawal exceeds `withdrawableAGI()` (balance minus `lockedEscrow`). | Check `withdrawableAGI()` and withdraw only surplus. |

## Pre-deploy / post-deploy verification checklist

**Pre-deploy (constructor inputs):**
- `agiToken` points to a standard ERC‑20 (no fee-on-transfer or rebasing).
- `ens`, `nameWrapper` addresses are correct for the deployment chain.
- `clubRootNode`, `agentRootNode`, `validatorMerkleRoot`, `agentMerkleRoot` match allowlist/ENS policy.
- Decide `requiredValidatorApprovals` + `requiredValidatorDisapprovals` (both ≤ 50).
- Set max agent payout percentage and ensure `maxAgentPayoutPercentage + validationRewardPercentage <= 100`.
- Set realistic `maxJobPayout`, `jobDurationLimit`, `completionReviewPeriod`, and `disputeReviewPeriod`.

**Post-deploy (before enabling users):**
- Read on-chain values:
  - `owner`, `paused`
  - `agiToken`, `ens`, `nameWrapper`
  - `requiredValidatorApprovals`, `requiredValidatorDisapprovals`, `validationRewardPercentage`
  - `maxJobPayout`, `jobDurationLimit`, `completionReviewPeriod`, `disputeReviewPeriod`, `premiumReputationThreshold`
  - `clubRootNode`, `agentRootNode`, `validatorMerkleRoot`, `agentMerkleRoot`
- Confirm at least one moderator is set.
- Dry-run: create a small job, validate, and confirm payout + NFT issuance.

## Operational assumptions

- **Validators**: Sufficient active validators exist to reach thresholds without exceeding `MAX_VALIDATORS_PER_JOB`.
- **Moderators**: At least one moderator is always available to resolve disputes.
- **Timeout operations**: Operators monitor overdue jobs and invoke `expireJob` / `finalizeJob` as needed.
- **ERC‑20 behavior**: The token behaves like a standard ERC‑20 (`transfer`/`transferFrom` success, no fee-on-transfer or rebasing).
- **ENS/NameWrapper availability**: ENS resolver and NameWrapper calls must succeed for on-chain eligibility checks; otherwise allowlists must compensate.
- **Gas**: Validator loops are O(n); keep validator counts low to avoid gas exhaustion.

## Helper script: parameter invariant checker (optional)

A small invariant checker script is provided to validate critical configuration values against safe bounds.

```bash
truffle exec scripts/ops/validate-params.js --network <network> --address <AGIJobManagerAddress> --from-block 0
```

- Exits non‑zero if any invariant fails.
- Uses on-chain reads plus `AGITypeUpdated` events to compute maximum agent payout percentage.
- Use it in pre‑deploy and post‑deploy checks as part of release operations.
