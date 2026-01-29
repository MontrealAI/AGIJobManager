# Adapter spec: AGIJobManager → ERC-8004 feedback

This adapter reads AGIJobManager events over a block range and aggregates **per-agent** (and optionally **per-validator**) metrics. It is intentionally **off-chain** and emits **ERC-8004 off-chain feedback files** (one JSON per signal) plus a small intermediate metrics JSON for traceability.

## Event → metric mapping
- `JobCreated(jobId, ...)`
  - Employer addresses are recorded for the “trusted client set” (addresses that created paid jobs).
- `JobApplied(jobId, agent)`
  - Increments `assignedCount` (AGIJobManager assigns on apply).
  - Records `assignedBlock` per job.
- `JobCompletionRequested(jobId, agent)`
  - Increments `jobsCompletionRequested` (kept as an internal diagnostic).
  - Adds response-time sample: `completionRequestedBlock - assignedBlock`.
- `JobCompleted(jobId, agent, ...)`
  - Increments `completedCount`.
  - Adds `job.payout` to `grossEscrow`.
  - Adds response-time sample when `JobCompletionRequested` is missing.
- `JobDisputed(jobId, ...)`
  - Increments `disputedCount` for the assigned agent.
- `DisputeResolved(jobId, resolution)`
  - Increments `agentWinCount`, `employerWinCount`, or `unknownResolutionCount` for the assigned agent.
- `JobValidated(jobId, validator)` (optional)
  - Increments `approvalsCount` for the validator.
- `JobDisapproved(jobId, validator)` (optional)
  - Increments `disapprovalsCount` for the validator.
- `ReputationUpdated(user, newReputation)` (optional)
  - If `user` is a known validator in-range, increments `reputationUpdates` and updates `latestReputation`.
  - `reputationGain` sums **positive deltas** between consecutive updates observed in-range (best-effort proxy only).

## Computed rates
Rates are expressed as percentages with `valueDecimals=2` (basis points of percent):
- `successRate` = `completedCount / assignedCount * 100`
- `disputeRate` = `disputedCount / assignedCount * 100`
- `approvalRate` = `approvalsCount / (approvalsCount + disapprovalsCount) * 100`

If denominators are 0, the rate is omitted. Rates are rounded deterministically using integer math (half-up).

## Derived metrics used for feedback
- `grossEscrow` (tag1): sum of `job.payout` values for completed jobs (raw token units).
- `netAgentPaidProxy` (tag1): `grossEscrow * current payoutPercentage / 100` (proxy only).
- `blocktimeFreshness` (tag1): `currentBlock - lastActivityBlock` (tag2=`blocks`).

## Recommended tag1 table (AGIJobManager-specific)
| tag1 | Derived from | Notes |
| --- | --- | --- |
| successRate | JobCompleted / JobApplied | valueDecimals=2 |
| disputeRate | JobDisputed / JobApplied | valueDecimals=2 |
| grossEscrow | JobCompleted payout sum | proxy, raw token units |
| netAgentPaidProxy | payoutPercentage proxy | best-effort; uses current payout % |
| blocktimeFreshness | lastActivityBlock | tag2=`blocks` |
| approvalRate | validator approvals | valueDecimals=2 (validators) |

## Evidence anchors
Every metric bundle includes `evidence.anchors[]` with:
- `txHash`, `logIndex`, `blockNumber`
- `event`, `jobId`
- `contractAddress`, `chainId`

Heavy data stays off-chain; anchors are sufficient to re-derive metrics.

## Output schema (intermediate JSON)
```json
{
  "version": "0.2",
  "metadata": {
    "chainId": 11155111,
    "network": "sepolia",
    "contractAddress": "0x...",
    "fromBlock": 0,
    "toBlock": 123456,
    "generatedAt": "2024-05-01T00:00:00.000Z",
    "toolVersion": "agijobmanager-erc8004-adapter@0.1.0"
  },
  "trustedClientSet": {
    "criteria": "addresses that created paid jobs in range",
    "addresses": ["0x..."],
    "evidence": {
      "anchors": [
        {
          "txHash": "0x...",
          "logIndex": 3,
          "blockNumber": 12345,
          "event": "JobCreated",
          "jobId": "1",
          "chainId": 11155111,
          "contractAddress": "0x..."
        }
      ]
    }
  },
  "agents": {
    "0xagent": {
      "assignedCount": 2,
      "completedCount": 1,
      "disputedCount": 1,
      "agentWinCount": 0,
      "employerWinCount": 1,
      "unknownResolutionCount": 0,
      "grossEscrow": "1000000000000000000",
      "netAgentPaidProxy": "600000000000000000",
      "agentPayoutPercentage": "60",
      "lastActivityBlock": 123456,
      "rates": {
        "successRate": {"value": 5000, "valueDecimals": 2},
        "disputeRate": {"value": 5000, "valueDecimals": 2}
      },
      "evidence": {"anchors": []}
    }
  },
  "validators": {
    "0xvalidator": {
      "approvalsCount": 3,
      "disapprovalsCount": 1,
      "rates": {
        "approvalRate": {"value": 7500, "valueDecimals": 2}
      },
      "lastActivityBlock": 123450,
      "evidence": {"anchors": []}
    }
  }
}
```

## ERC-8004 off-chain feedback output
Each feedback file is a **single JSON object** that matches the EIP-8004 off-chain feedback structure:
- Required: `agentRegistry`, `agentId`, `clientAddress`, `createdAt`, `value`, `valueDecimals`
- Optional (used here): `tag1`, `tag2`, `comment`, `endpoint`, `proofOfPayment`

## Notes
- `grossEscrow` is the sum of job `payout` values for completed jobs (raw token units).
- `netAgentPaidProxy` is best-effort and uses the **current** payout percentage at export time.
- Resolution strings are treated case-insensitively and mapped to `agent win` / `employer win`.
