# Moderator Guide

Moderators resolve disputed jobs. Only accounts listed in `moderators` can resolve disputes.

## Resolution strings (exact match)
The contract only triggers actions for **exactly** these strings:
- `"agent win"` → pays the agent and completes the job.
- `"employer win"` → refunds the employer and closes the job.

Any other string will **only** emit a `DisputeResolved` event and close the dispute without payouts.

## Step‑by‑step (non‑technical)
> **Screenshot placeholder:** Etherscan “Write Contract” tab showing `resolveDispute` inputs filled in.
1. Confirm the job is disputed (look for the `JobDisputed` event).
2. Call `resolveDispute(jobId, resolution)` with the exact string above.
3. Verify the `DisputeResolved` event.

## Expected moderation policy (recommended)
- Require evidence from the agent (final work artifacts) and employer (requirements).
- Record a plain‑English reason in the `resolution` string if you are not using the canonical payout strings.
- Keep a public log of disputes and resolutions off‑chain.

## For developers
### Key function
- `resolveDispute(jobId, resolution)`

### Events to index
`DisputeResolved`
