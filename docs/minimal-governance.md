# Minimal Governance & Configuration Lock

This document describes the **one‑way configuration lock** and the operating posture: **deploy → configure → validate → lock → operate**.

## What the configuration lock does

Calling `lockConfiguration()` permanently sets `configLocked = true`. Once locked, configuration‑changing admin functions revert with `InvalidState`.

**Irreversible**: there is no unlock mechanism. To change locked parameters, redeploy a new contract.

## Disabled after lock (explicit list)

The following functions are disabled once `configLocked` is true:

- `updateAGITokenAddress`
- `setBaseIpfsUrl`
- `setAlphaRootNodes`
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

## Still allowed after lock (break‑glass only)

These remain available for emergency response or operational safety:

- `pause()` / `unpause()`
- `resolveStaleDispute()` (owner, **only while paused**)
- `resolveDisputeWithCode()` (moderators)
- `blacklistAgent()` / `blacklistValidator()`
- `addModerator()` / `removeModerator()`
- `withdrawAGI()` (owner, **only while paused**)
- `delistJob()` (owner, only for unassigned jobs)

> Recommended posture: treat these as **break‑glass actions** and require an incident runbook + signer sign‑off.

## Recommended operational sequence

1. **Deploy** (use environment‑driven addresses and Merkle roots).
2. **Configure** (set parameters, allowlists, payout tiers).
3. **Validate** (run smoke tests on a small job lifecycle).
4. **Lock** (call `lockConfiguration()` once satisfied).
5. **Operate** (minimal governance; break‑glass only).

## Sepolia / local / private deployments

Keep deploy‑time configurability by setting environment overrides:

- `AGI_TOKEN_ADDRESS`
- `AGI_ENS_ADDRESS`
- `AGI_NAME_WRAPPER_ADDRESS`
- `AGI_CLUB_ROOT_NODE`
- `AGI_ALPHA_CLUB_ROOT_NODE`
- `AGI_AGENT_ROOT_NODE`
- `AGI_ALPHA_AGENT_ROOT_NODE`
- `AGI_VALIDATOR_MERKLE_ROOT`
- `AGI_AGENT_MERKLE_ROOT`

Mainnet defaults are invariant identity anchors (documented in **[docs/deployment-checklist.md](deployment-checklist.md)**), but non‑mainnet deployments should override them as needed.
