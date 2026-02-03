# Minimal governance model

This document explains the **configuration lock** and the intended “configure once → operate” posture.

## What the configuration lock does

Calling `lockConfiguration()` permanently disables configuration-changing admin functions. It is **one-way** and irreversible.

Once locked, the contract keeps operating for normal jobs, escrows, and dispute flows, but governance surface is minimized.

## Functions disabled after lock

These functions are guarded by `whenConfigurable` and **revert** once the configuration is locked:

**Economic + policy knobs**
- `setRequiredValidatorApprovals`
- `setRequiredValidatorDisapprovals`
- `setPremiumReputationThreshold`
- `setValidationRewardPercentage`
- `setAdditionalAgentPayoutPercentage`
- `setMaxJobPayout`
- `setJobDurationLimit`
- `setCompletionReviewPeriod`
- `setDisputeReviewPeriod`

**Identity + allowlist controls**
- `addAdditionalValidator` / `removeAdditionalValidator`
- `addAdditionalAgent` / `removeAdditionalAgent`

**Metadata + UI/terms**
- `setBaseIpfsUrl`
- `updateTermsAndConditionsIpfsHash`
- `updateContactEmail`
- `updateAdditionalText1/2/3`

**Token + types + admin cleanup**
- `updateAGITokenAddress`
- `addAGIType`
- `delistJob`
- `withdrawAGI`

## Functions still available after lock

These are considered **break-glass** or operational safety controls:

- `pause()` / `unpause()` — incident response.
- `resolveStaleDispute()` — owner-only recovery **while paused**, after the dispute timeout.
- `blacklistAgent()` / `blacklistValidator()` — abuse mitigation.
- `addModerator()` / `removeModerator()` — optional moderator rotation for continuity.

> **Note:** `transferOwnership` remains available via `Ownable`. Operators should decide whether to transfer ownership to a long-lived multisig or leave ownership unchanged after lock.

## Recommended operational sequence

1. **Deploy** (set ENS/NameWrapper/token/root nodes and Merkle roots).
2. **Configure** (thresholds, payouts, metadata, moderators, allowlists).
3. **Validate** (run sanity checks and real job flow).
4. **Lock** (`lockConfiguration()` or `LOCK_CONFIG=true` during migration).
5. **Operate** (minimal governance with incident-response tools only).

## Notes for Sepolia/local/private deployments

- Keep **ENS registry** and **NameWrapper** addresses configurable (`AGI_ENS_REGISTRY`, `AGI_NAMEWRAPPER`).
- Override the AGI token address for non-mainnet networks (`AGI_TOKEN_ADDRESS`).
- Root nodes and Merkle roots should be set per environment.
