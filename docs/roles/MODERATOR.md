# Moderator Guide

Moderators resolve disputed jobs. Only accounts listed in `moderators` can resolve disputes.

## Resolution codes (typed)
Use `resolveDisputeWithCode(jobId, resolutionCode, reason)`:
- `0 (NO_ACTION)` → log only; dispute remains active.
- `1 (AGENT_WIN)` → pays the agent and completes the job.
- `2 (EMPLOYER_WIN)` → refunds the employer and closes the job.

The `reason` string is freeform for logs/UI and does not control settlement. The legacy `resolveDispute` string interface is deprecated and maps only the exact `"agent win"` / `"employer win"` strings to settlement actions.

## Step‑by‑step (non‑technical)
> **Screenshot placeholder:** Etherscan “Write Contract” tab showing `resolveDisputeWithCode` inputs filled in.
1. Confirm the job is disputed (look for the `JobDisputed` event).
2. Call `resolveDisputeWithCode(jobId, resolutionCode, reason)` with the typed code above.
3. Verify the `DisputeResolvedWithCode` event (and `DisputeResolved` if the dispute was finalized).

## Expected moderation policy (recommended)
- Require evidence from the agent (final work artifacts) and employer (requirements).
- Record a plain‑English reason in the `reason` field for auditability.
- Keep a public log of disputes and resolutions off‑chain.

## For developers
### Key function
- `resolveDisputeWithCode(jobId, resolutionCode, reason)`

### Events to index
`DisputeResolvedWithCode` (and `DisputeResolved` for finalized settlements)
