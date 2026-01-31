# Parameter safety & stuck-funds analysis (mainnet operator)

This document is written for operators deploying and running `AGIJobManager` on Ethereum mainnet. It focuses on **parameter safety**, **settlement math**, and **recovery procedures** grounded in the live contract behavior in `contracts/AGIJobManager.sol`.

> **Operator mindset:** You are responsible for parameter selection, managing allowlists, and ensuring escrow solvency for jobs. This document treats misconfiguration as the primary risk and provides runbooks to recover when it happens.

## Parameter inventory (operator-controlled)

The table below lists configurable parameters and relevant caps, including who can change them, their role in settlement or lifecycle, and operator-safe ranges.

| Parameter | Who can change | How it is used | On-chain enforced bounds | Recommended operational range | Failure mode if mis-set |
| --- | --- | --- | --- | --- | --- |
| `agiToken` | Owner (`updateAGITokenAddress`) | ERC‑20 used for escrow deposits, payouts, reward pool, and withdrawals. | None. | **Never change** after any job funds are deposited. Treat as immutable post‑deploy. | If changed after jobs are funded, payouts will attempt the *new* token while escrow sits in the old token. Completion/cancellation transfers can revert from insufficient balance; old token escrow becomes unrecoverable (no in-contract method to transfer old token). Funds can become permanently stuck. |
| `requiredValidatorApprovals` | Owner (`setRequiredValidatorApprovals`) | Approvals needed to auto‑complete a job via `validateJob`. | `<= MAX_VALIDATORS_PER_JOB`; `approvals + disapprovals <= MAX_VALIDATORS_PER_JOB`. | **2–5** (or <= available validator count). Ensure enough active validators can realistically approve. | Too high → job completion requires more validators than are available; jobs can stall and require moderator dispute resolution. Setting to `0` makes any validation sufficient, which may be too weak for trust. |
| `requiredValidatorDisapprovals` | Owner (`setRequiredValidatorDisapprovals`) | Disapprovals needed to mark job as `disputed` in `disapproveJob`. | `<= MAX_VALIDATORS_PER_JOB`; `approvals + disapprovals <= MAX_VALIDATORS_PER_JOB`. | **1–3**; keep low so disputes are reachable with a small validator set. | Too high → disputes rarely trigger; jobs can remain in limbo if approvals never reach threshold. Setting to `0` means *any* disapproval triggers dispute. |
| `validationRewardPercentage` | Owner (`setValidationRewardPercentage`) | Total % of payout distributed to validators on completion. | `1..100` | **Keep low enough so:** `maxAgentPayoutPercentage + validationRewardPercentage <= 100`. Commonly **1–10%**. | If `validationRewardPercentage + agent payout % > 100` and validators are present, settlement reverts due to insufficient escrow, making jobs uncompletable. |
| `maxJobPayout` | Owner (`setMaxJobPayout`) | Caps `_payout` in `createJob`. | None. | Keep near realistic operational exposure (e.g., default `4888e18`). Avoid enormous values that stress reputation math and escrow solvency. | Too low → `createJob` reverts. Too high → giant payouts can make reputation math overflow or exceed escrow solvency in completion; settlement reverts. |
| `jobDurationLimit` | Owner (`setJobDurationLimit`) | Caps `_duration` in `createJob` and controls when `requestJobCompletion` can be called. | None. | Pick a duration aligned with business SLAs (seconds). | Too low → `createJob` reverts or agents miss the completion request window. Too high → long‑running jobs remain open for extended periods. |
| `completionReviewPeriod` | Owner (`setCompletionReviewPeriod`) | Review window after `requestJobCompletion` before `finalizeJob` can be used (only when validators are silent). | `1..365 days` | **Hours to days** (e.g., 24h–7d). Keep short enough to unblock payouts but long enough for employer/validators to act. | Too short → employers/validators may miss review and silent-finalization becomes common. Too long → agent payouts can remain locked unnecessarily. |
| `disputeReviewPeriod` | Owner (`setDisputeReviewPeriod`) | Emergency window before `resolveStaleDispute` can be used (paused + owner only). | `1..365 days` | **Days to weeks** (e.g., 7d–30d). Keep long enough for moderators to act, but not so long that disputes deadlock. | Too short → owner can resolve disputes too quickly during incidents; too long → disputes can remain stuck if moderators vanish. |
| `premiumReputationThreshold` | Owner (`setPremiumReputationThreshold`) | Gate for `canAccessPremiumFeature`. | None. | Set based on desired premium access policy; no settlement impact. | Mis-set only affects premium feature access (not escrow or payouts). |
| `MAX_VALIDATORS_PER_JOB` (constant) | Immutable | Caps validators per job and enforces `requiredValidatorApprovals + requiredValidatorDisapprovals <= 50`. | `50` | Keep validator thresholds well below 50 to ensure reachable consensus and reasonable gas. | If validator thresholds approach 50, a single unexpected disapproval can make approvals unreachable; disputes may become the only path. |
| `AGIType.payoutPercentage` (per NFT) | Owner (`addAGIType`) | Determines agent payout percentage via `getHighestPayoutPercentage`. | `1..100` | Choose a **max agent payout %** so that `maxAgentPayoutPercentage + validationRewardPercentage <= 100`. | If any agent holds an NFT with a payout percentage that, combined with `validationRewardPercentage`, exceeds 100, job completion will revert when validator payouts execute. |
| `clubRootNode`, `agentRootNode`, `validatorMerkleRoot`, `agentMerkleRoot` | Immutable post‑deploy | Gate eligibility for validators/agents via ENS + Merkle proofs. | Set only in constructor (no setters). | Validate before deployment; keep canonical allowlists and ENS settings accurate. | Mis-set roots can prevent validators/agents from ever qualifying, blocking validation and making jobs uncompletable without manual additional allowlisting or redeploy. |
| `additionalValidators`, `additionalAgents` | Owner (`addAdditionalValidator`, `addAdditionalAgent`) | Manual allowlist bypass for eligibility checks. | None. | Use as a recovery tool when allowlist/ENS config blocks participation. | Overuse weakens trust; underuse when root nodes are wrong can stall jobs. |

## Settlement math safety

### Payout formulas and rounding

On completion (`_completeJob`), the contract executes the following calculations:

- **Agent payout**: `agentPayout = job.payout * agentPayoutPercentage / 100`
- **Validator pool**: `totalValidatorPayout = job.payout * validationRewardPercentage / 100`
- **Per-validator payout**: `validatorPayout = totalValidatorPayout / vCount`

**Rounding behavior:** all divisions are integer divisions; any remainder stays in the contract. Specifically:
- Any fractional remainder from `agentPayout` is retained by the contract.
- Any remainder from `totalValidatorPayout / vCount` stays in the contract.
- There is no “dust” redistribution. Remaining tokens are only recoverable by the owner via `withdrawAGI`.

### Safety constraints derived from settlement

1. **Total payout must not exceed escrow.**
   - Since validator payouts are **not** deducted from agent payout, the total distributed in a completion is:
     ```
     job.payout * (agentPayoutPercentage + validationRewardPercentage) / 100
     ```
   - If this sum exceeds `job.payout`, the contract will attempt to transfer more than it has; `_safeERC20Transfer` will revert, leaving the job uncompleted.
   - **Operational rule:** ensure `maxAgentPayoutPercentage + validationRewardPercentage <= 100`.

2. **Validator count drives payout and gas.**
   - The loop runs once per validator, capped at `MAX_VALIDATORS_PER_JOB` (50). Gas cost scales linearly. Keep typical validator counts small.

3. **Overflow/revert considerations (Solidity 0.8+):**
   - `calculateReputationPoints` uses `scaledPayout ** 3`. Extremely high `job.payout` values can overflow and revert completion.
   - `enforceReputationGrowth` squares `newReputation`, which can also overflow if `newReputation` becomes enormous.
   - **Operational rule:** keep `maxJobPayout` at realistic levels (e.g., the current default of `4888e18`) to avoid overflow and minimize escrow exposure.

## Stuck-funds analysis (realistic scenarios)

Below are plausible misconfiguration or operational failures that can trap funds or make jobs uncompletable.

### 1) ERC‑20 token address changed after jobs are funded
- **Symptom:** Validators attempt to approve; completion reverts. Employer/agent cannot receive payouts or refunds.
- **Root cause:** `agiToken` was updated while escrow for existing jobs remains in the old token. Payouts now target the new token balance (likely zero).
- **On‑chain recovery:** **None** for existing escrow in the old token; there is no function to transfer arbitrary ERC‑20s out. `withdrawAGI` only works for the *current* token.
- **Operational recovery:** Pause the contract, and redeploy a new instance. If possible, coordinate off‑chain refunds from treasury.
- **Outcome:** **Funds can be permanently stuck** in the old token.

### 2) `validationRewardPercentage + agent payout % > 100`
- **Symptom:** Any completion attempt reverts during validator payouts.
- **Root cause:** Agent payout is paid first; validator payouts are then attempted from remaining escrow. If total exceeds escrow, transfers fail.
- **On‑chain recovery:** Update `validationRewardPercentage` or reduce any `AGIType.payoutPercentage` so the total is ≤ 100. After changing, a validator can retry `validateJob` to complete.
- **Operational recovery:** Pause to prevent new jobs, adjust parameters, unpause, and instruct validators to re‑submit.
- **Outcome:** **Recoverable** once parameters are fixed.

### 3) Validator thresholds too high or validator eligibility misconfigured
- **Symptom:** Approvals never reach `requiredValidatorApprovals`; disputes never reach `requiredValidatorDisapprovals`.
- **Root cause:** Thresholds exceed the available validator set, or Merkle/ENS gating blocks validators from proving eligibility. Roots are immutable post‑deploy.
- **On‑chain recovery:**
  - Lower thresholds via `setRequiredValidatorApprovals` / `setRequiredValidatorDisapprovals`.
  - Add validators directly with `addAdditionalValidator` to bypass allowlist/ENS.
  - As a last resort, use `disputeJob` + `resolveDispute` (moderator required) to close jobs.
- **Operational recovery:** Pause, correct thresholds, add validators, unpause, and have validators re‑validate.
- **Outcome:** **Recoverable** if owner/moderator actions are available.

### 3b) Employer/validator silence after completion request
- **Symptom:** Agent requested completion, but no validators or employer act.
- **Root cause:** Review/validation activity never occurs.
- **On‑chain recovery:** After `completionReviewPeriod`, the assigned agent (or employer) can call `finalizeJob` **only if** no validator activity exists (approvals/disapprovals are both zero).
- **Operational recovery:** Choose a review period long enough to permit normal review. Shorten or lengthen as needed via `setCompletionReviewPeriod`.
- **Outcome:** **Recoverable** without owner intervention.

### 3c) Agent disappearance after assignment
- **Symptom:** Agent never requests completion; job is past its deadline.
- **Root cause:** Assigned agent disappears or misses the duration window.
- **On‑chain recovery:** Anyone can call `expireJob` after `assignedAt + duration` (only if completion was never requested) to refund the employer.
- **Operational recovery:** Monitor overdue jobs and trigger expiration.
- **Outcome:** **Recoverable** without owner intervention.

### 3d) Disputed jobs with no moderator availability
- **Symptom:** Job is disputed and no moderator action occurs.
- **Root cause:** Moderator key loss, unavailability, or operational outage.
- **On‑chain recovery:** Owner can pause the contract and call `resolveStaleDispute` after `disputeReviewPeriod` to complete or refund.
- **Operational recovery:** Maintain moderator redundancy; reserve `resolveStaleDispute` for incident recovery.
- **Outcome:** **Recoverable** with owner intervention.

### 4) Token transfer failures to specific recipients
- **Symptom:** Settlement reverts when paying a validator or agent (or employer in disputes/cancels).
- **Root cause:** ERC‑20 transfers fail (blacklisted address, paused token, or non‑standard behavior). `_safeERC20Transfer` treats any failure as a revert.
- **On‑chain recovery:** None if the token refuses transfer to that address.
- **Operational recovery:** Prefer `disputeJob` and resolve in favor of the counterparty **only if that address can receive tokens**. If the token itself is frozen, jobs cannot be settled.
- **Outcome:** Potentially **stuck** until token behavior changes or you redeploy.

### 5) Owner withdraws escrowed funds (`withdrawAGI`)
- **Symptom:** Validations revert due to insufficient escrow; jobs cannot complete.
- **Root cause:** Owner removed escrow backing existing jobs.
- **On‑chain recovery:** Owner must re‑fund the contract so payouts succeed.
- **Operational recovery:** Pause, restore contract balance, unpause, and re‑validate.
- **Outcome:** **Recoverable** if owner replenishes funds.

### 6) Misuse of `resolveDispute` resolution strings
- **Symptom:** Dispute is cleared but no payout occurs; job remains incomplete.
- **Root cause:** `resolveDispute` only triggers payouts for exact strings `"agent win"` or `"employer win"`. Other strings only clear the dispute flag.
- **On‑chain recovery:** Re‑dispute and resolve with the correct string.
- **Operational recovery:** Educate moderators on canonical resolution strings; keep a runbook.
- **Outcome:** **Recoverable** with proper moderator action.

## Pre‑deploy / post‑deploy parameter sanity checklist

### Pre‑deploy (before contract creation)
1. **Token selection:** confirm `agiToken` is a standard ERC‑20 (no fee‑on‑transfer, no rebasing) and will not be changed post‑deploy.
2. **Eligibility roots:** verify `clubRootNode`, `agentRootNode`, `validatorMerkleRoot`, and `agentMerkleRoot` against your allowlists and ENS settings.
3. **Validator thresholds:** choose `requiredValidatorApprovals` and `requiredValidatorDisapprovals` so that your known validator set can reach them quickly.
4. **Payout economics:** define a maximum `AGIType.payoutPercentage` and choose `validationRewardPercentage` so their sum is **≤ 100**.
5. **Exposure controls:** set `maxJobPayout`, `jobDurationLimit`, and `completionReviewPeriod` aligned with operational SLAs and escrow risk.
6. **Dispute safety:** set `disputeReviewPeriod` to a realistic incident-recovery window.

### Post‑deploy (before opening to users)
1. **Read on‑chain values** (via `eth_call`):
   - `requiredValidatorApprovals`, `requiredValidatorDisapprovals`
   - `validationRewardPercentage`, `maxJobPayout`, `jobDurationLimit`
   - `premiumReputationThreshold`, `completionReviewPeriod`, `disputeReviewPeriod`, `MAX_VALIDATORS_PER_JOB`
   - `agiToken`, `clubRootNode`, `agentRootNode`, `validatorMerkleRoot`, `agentMerkleRoot`
2. **Verify add‑on configuration:** check `AGIType` entries to confirm max payout percentages.
3. **Dry‑run acceptance:** have one agent and one validator prove eligibility (Merkle/ENS) and perform a small‑value job end‑to‑end.

## Recovery playbook (operator runbook)

1. **Stop the bleeding:**
   - Call `pause()` if misconfiguration is causing failed settlements or unexpected behavior.

2. **Fix misconfiguration:**
   - Adjust validator thresholds (`setRequiredValidatorApprovals`, `setRequiredValidatorDisapprovals`).
   - Adjust payout percentages (`setValidationRewardPercentage`, `addAGIType`).
   - Add emergency allowlisted validators/agents (`addAdditionalValidator`, `addAdditionalAgent`).
   - **Do not** change `agiToken` when escrow is outstanding.

3. **Unstick existing jobs:**
   - For unassigned jobs: employer can `cancelJob` (if no agent assigned). Owner can `delistJob` to refund.
   - For assigned jobs: instruct validators to retry `validateJob` or `disapproveJob` after parameters are fixed.
   - If validators cannot reach thresholds, use `disputeJob` and resolve with `resolveDispute` (moderator only).

4. **Validate recovery:**
   - Use `getJobStatus` and the public `jobs(jobId)` getter to confirm `completed`/`disputed` status.
   - Confirm contract token balance is ≥ expected payout obligations.

## Optional hardening ideas (no code changes in this task)

If you plan a future upgrade or redeploy, consider:
- Enforce `agentPayoutPercentage + validationRewardPercentage <= 100` in `addAGIType` or `setValidationRewardPercentage` to prevent uncompletable jobs.
- Disallow `updateAGITokenAddress` once `nextJobId > 0` or once any escrow exists.
- Add a controlled rescue method for non‑current tokens (with strict event logging and governance).
- Require `completionRequested` before `validateJob` to align on‑chain behavior with off‑chain expectations.
