# Minimal governance mode (configuration lock)

AGIJobManager supports a **one-way configuration lock** to enforce a "configure once, then operate" posture.

## What the lock does
Calling `lockConfiguration()` permanently disables configuration-changing admin functions. This reduces ongoing governance surface while preserving core operational controls.

- The lock is **irreversible**.
- The lock state is exposed via `configLocked()`.

## Recommended operational sequence
1. **Deploy**
2. **Configure** (set economics, allowlists, metadata, moderators)
3. **Validate** (run post-deploy sanity checks)
4. **Lock** configuration
5. **Operate** with minimal governance

## Functions disabled after lock
The following functions are guarded by `whenConfigurable` and are unavailable once locked:

**Economic parameters / settings**
- `updateAGITokenAddress`
- `setBaseIpfsUrl`
- `setRequiredValidatorApprovals`
- `setRequiredValidatorDisapprovals`
- `setPremiumReputationThreshold`
- `setMaxJobPayout`
- `setJobDurationLimit`
- `setCompletionReviewPeriod`
- `setDisputeReviewPeriod`
- `setAdditionalAgentPayoutPercentage`
- `setValidationRewardPercentage`

**Metadata / operator content**
- `updateTermsAndConditionsIpfsHash`
- `updateContactEmail`
- `updateAdditionalText1/2/3`

**Allowlists / AGI types**
- `addAGIType`
- `addAdditionalAgent` / `removeAdditionalAgent`
- `addAdditionalValidator` / `removeAdditionalValidator`

## Functions still available after lock (break-glass controls)
To support incident response and escrow safety, the following controls remain available:
- `pause` / `unpause`
- `resolveStaleDispute` (while paused)
- `blacklistAgent` / `blacklistValidator`
- `addModerator` / `removeModerator`
- `withdrawAGI` (while paused)

These are retained to mitigate compromised accounts, recover from long-running disputes, and move surplus funds safely.

## Deploy-time overrides for non-mainnet
Deployments on Sepolia/local/private networks should override network-specific addresses via env vars (see `.env.example` and [`docs/deployment-checklist.md`](deployment-checklist.md)).

## Toolchain note
The Truffle build uses Solidity `0.8.26`, optimizer enabled with `runs=500`, and `viaIR=true` to avoid stack-too-deep errors at the current contract size.
