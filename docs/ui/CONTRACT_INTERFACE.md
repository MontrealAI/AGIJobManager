# UI Contract Interface Snapshot

This file is **auto-generated** from `ui/src/abis/agiJobManager.ts`.

- Generated at: 2026-02-13T16:51:01.071Z
- Source ABI: `ui/src/abis/agiJobManager.ts`

## Functions used by UI

- owner (view)
- paused (view)
- settlementPaused (view)
- nextJobId (view)
- completionReviewPeriod (view)
- disputeReviewPeriod (view)
- voteQuorum (view)
- requiredValidatorApprovals (view)
- requiredValidatorDisapprovals (view)
- withdrawableAGI (view)
- moderators (view)
- getJobCore (view)
- getJobValidation (view)
- getJobSpecURI (view)
- getJobCompletionURI (view)
- tokenURI (view)
- cancelJob (nonpayable)
- finalizeJob (nonpayable)
- disputeJob (nonpayable)
- applyForJob (nonpayable)
- requestJobCompletion (nonpayable)
- validateJob (nonpayable)
- disapproveJob (nonpayable)
- resolveDisputeWithCode (nonpayable)
- pause (nonpayable)
- unpause (nonpayable)
- setSettlementPaused (nonpayable)

## Events used by UI

- JobCreated
- JobApplied
- JobCompletionRequested
- JobValidated
- JobDisapproved
- JobDisputed
- DisputeResolvedWithCode
- JobCompleted
- JobCancelled
- JobExpired
- NFTIssued

## Custom errors decoded by UI

- InvalidParameters
- InvalidState
- NotAuthorized
- SettlementPaused
- JobNotFound
- Blacklisted
- NotModerator

## UI compatibility contract

The UI assumes the selected AGIJobManager deployment exposes all functions, events, and custom errors listed above.
If contract interfaces drift, regenerate this file and update UI call sites + tests before release.
