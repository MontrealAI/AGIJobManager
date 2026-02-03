# Minimal governance: configuration lock

`AGIJobManager` supports a **one-way configuration lock** so operators can configure once and then run with minimal governance.

## What the lock does

Calling `lockConfiguration()` sets `configLocked = true` permanently and emits `ConfigurationLocked(by)`. Once locked, configuration-changing admin functions revert with `ConfigLocked()`.

## Disabled after lock (non-exhaustive, explicit list)

The following owner-only configuration setters are disabled once locked:

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
- `updateTermsAndConditionsIpfsHash`
- `updateContactEmail`
- `updateAdditionalText1`
- `updateAdditionalText2`
- `updateAdditionalText3`
- `addAGIType`
- `addAdditionalAgent` / `removeAdditionalAgent`
- `addAdditionalValidator` / `removeAdditionalValidator`
- `delistJob`
- `withdrawAGI`
- `lockConfiguration` (subsequent calls revert)

These freezes include economic knobs, allowlist mutators, and metadata settings to minimize governance surface.

## Still allowed after lock (break-glass + operations)

The following remain available for safety and continuity:

- **Pause/unpause** (`pause`, `unpause`).
- **Stale dispute recovery** (`resolveStaleDispute`) while paused.
- **Moderator rotation** (`addModerator`, `removeModerator`).
- **Blacklist updates** (`blacklistAgent`, `blacklistValidator`).
- Normal job lifecycle flows for employers/agents/validators.

> **Note:** Ownership transfer is still available via `transferOwnership` on the `Ownable` base; perform any ownership handoffs before locking if you want an immutable governance posture.

## Recommended operational sequence

1. **Deploy**
2. **Configure** (set token, ENS/NameWrapper, parameters, allowlists)
3. **Validate** (run sanity checks on job flow)
4. **Lock** (`lockConfiguration()`)
5. **Operate** (minimal governance; break-glass only)

## Sepolia/local/private deployments

Use environment overrides for network-specific addresses (token, ENS registry, NameWrapper, and root nodes). The lock works the same way across all networks—only apply it after you have validated the deployment on that network.
