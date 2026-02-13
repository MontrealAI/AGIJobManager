# Operations Runbook

## Configuration catalog

| Parameter | Purpose | Safe range guidance | Operational notes | Where set |
| --- | --- | --- | --- | --- |
| `requiredValidatorApprovals` | Approval threshold | >=1 and <= validator quorum | Raise gradually with validator capacity | owner setter |
| `requiredValidatorDisapprovals` | Disapproval threshold | >=1 and <= validator quorum | Keep symmetric with approval policy unless policy exception is deliberate | owner setter |
| `completionReviewPeriod` | Validator voting window | Long enough for global validator coverage | Too short harms liveness | owner setter |
| `disputeReviewPeriod` | Moderator resolution window | Sized for human response | Coordinate moderation on-call | owner setter |
| `challengePeriodAfterApproval` | Delay before finalize | Prevent instant settlement races | Keep stable once in production | owner setter |

## Parameter-change checklist

1. Record current values and reason for change.
2. Simulate impact in staging.
3. Execute owner transaction.
4. Verify events emitted and getters updated.
5. Publish operator note and rollback criteria.
