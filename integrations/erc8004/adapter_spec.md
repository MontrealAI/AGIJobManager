# Adapter specification (AGIJobManager → ERC-8004)

This document describes how the adapter script aggregates AGIJobManager events into ERC-8004-compatible metrics.

## Data sources (events)
- `JobCreated(jobId, ipfsHash, payout, duration, details)`
- `JobApplied(jobId, agent)`
- `JobCompletionRequested(jobId, agent)`
- `JobValidated(jobId, validator)`
- `JobDisapproved(jobId, validator)`
- `JobCompleted(jobId, agent, reputationPoints)`
- `JobDisputed(jobId, disputant)`
- `DisputeResolved(jobId, resolver, resolution)`

## Primary aggregation keys
- **Agent address** (from `JobApplied` / `JobCompleted`).
- **Employer address** (from `JobCreated` transaction sender; used for trusted client set).
- **Validator address** (optional; from `JobValidated` / `JobDisapproved`).

## Per-agent metrics
| Metric | Source | Definition | ERC-8004 tag | valueDecimals |
| --- | --- | --- | --- | --- |
| jobsAssigned | `JobApplied` | Count of jobs where agent was assigned | `jobsAssigned` | 0 |
| jobsCompleted | `JobCompleted` | Count of completed jobs | `jobsCompleted` | 0 |
| jobsDisputed | `JobDisputed` | Count of jobs with a dispute flag | `jobsDisputed` | 0 |
| employerWins | `DisputeResolved` | Resolution string == `"employer win"` (case-insensitive) | `employerWins` | 0 |
| agentWins | `DisputeResolved` | Resolution string == `"agent win"` (case-insensitive) | `agentWins` | 0 |
| unknownResolutions | `DisputeResolved` | Any other resolution string | `unknownResolutions` | 0 |
| successRate | derived | `jobsCompleted / jobsAssigned` | `successRate` | 2 (percent with 2 decimals) |
| disputeRate | derived | `jobsDisputed / jobsAssigned` | `disputeRate` | 2 (percent with 2 decimals) |
| revenues | derived | Sum of `JobCreated.payout` for completed jobs | `revenues` | 0 |

**Note:** `successRate` and `disputeRate` are emitted as percentages with 2 decimal places (e.g., 99.80% → value 9980, valueDecimals 2).

## Optional validator metrics
If `INCLUDE_VALIDATORS=true`:
- `jobsValidated` — count of `JobValidated` per validator.
- `jobsDisapproved` — count of `JobDisapproved` per validator.

These are output under a `validators` map in the JSON artifact.

## Resolution handling
`DisputeResolved` accepts any resolution string. The adapter only categorizes two canonical values:
- `agent win`
- `employer win`

All other values are counted as `unknownResolutions`.

## Trusted client set
To derive a trusted eligibility set for ERC-8004 feedback submission, use **employer addresses** extracted from `JobCreated` transactions (i.e., the `from` address). Only addresses that actually funded jobs are included.
