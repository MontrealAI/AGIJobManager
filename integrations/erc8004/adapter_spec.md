# Adapter spec: AGIJobManager → ERC‑8004 feedback

This adapter reads AGIJobManager events over a block range and aggregates **per‑agent** reputation metrics, with optional **per‑validator** aggregates. It is intentionally **off‑chain** and emits **ERC‑8004 reputation‑v1** files (plus a small intermediate metrics JSON for traceability).

## Event → metric mapping
- `JobCreated(jobId, ...)`
  - Employer addresses are recorded for the “trusted client set” (addresses that created paid jobs).
- `JobApplied(jobId, agent)`
  - Increments `jobsApplied` and `jobsAssigned` for the agent (AGIJobManager assigns on apply).
  - Records `assignedBlock` per job.
- `JobCompletionRequested(jobId, agent)`
  - Increments `jobsCompletionRequested`.
  - Adds response‑time sample: `completionRequestedBlock - assignedBlock`.
- `JobCompleted(jobId, agent, ...)`
  - Increments `jobsCompleted`.
  - Adds `job.payout` to `revenuesProxy`.
  - Adds response‑time sample when `JobCompletionRequested` is missing.
- `JobDisputed(jobId, ...)`
  - Increments `jobsDisputed` for the assigned agent.
- `DisputeResolved(jobId, resolution)`
  - Increments `agentWins`, `employerWins`, or `unknownResolutions` for the assigned agent.
- `JobValidated(jobId, validator)` (optional)
  - Increments `approvals` for the validator.
- `JobDisapproved(jobId, validator)` (optional)
  - Increments `disapprovals` for the validator.
- `ReputationUpdated(user, newReputation)` (optional)
  - If `user` is a known validator in‑range, increments `reputationUpdates` and updates `latestReputation`.
  - `reputationGain` sums **positive deltas** between consecutive updates observed in‑range (best‑effort proxy only).

## Computed rates
Rates are expressed as percentages with `valueDecimals=2` (basis points of percent):
- `successRate` = `jobsCompleted / jobsAssigned * 100`
- `disputeRate` = `jobsDisputed / jobsAssigned * 100`

If `jobsAssigned` is 0, rates are omitted. Rates are rounded deterministically using integer math (half‑up).

## Derived metrics used for feedback
- `responseTime` (tag1): average block delta between assignment and completion request (fallback: completion).
- `blocktimeFreshness` (tag1): `currentBlock - lastActivityBlock`.
- `revenues` (tag1): `revenuesProxy` (sum of job payout values for completed jobs).

## Recommended tag1 table (AGIJobManager‑specific)
| tag1 | Derived from | Notes |
| --- | --- | --- |
| successRate | JobCompleted / JobApplied | valueDecimals=2 |
| disputeRate | JobDisputed / JobApplied | valueDecimals=2 |
| responseTime | JobApplied → JobCompletionRequested | tag2=`blocks` |
| blocktimeFreshness | lastActivityBlock | tag2=`blocks` |
| revenues | JobCompleted payout sum | proxy, raw token units |
| ownerVerified | external check | not derivable on-chain |
| reachable | external check | not derivable on-chain |
| uptime | external monitoring | not derivable on-chain |

## Evidence anchors
Every metric bundle includes `evidence.anchors[]` with:
- `txHash`, `logIndex`, `blockNumber`
- `event`, `jobId`
- `contractAddress`, `chainId`

Heavy data stays off‑chain; anchors are sufficient to re‑derive metrics.

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
      "jobsApplied": 2,
      "jobsAssigned": 2,
      "jobsCompletionRequested": 1,
      "jobsCompleted": 1,
      "jobsDisputed": 0,
      "employerWins": 0,
      "agentWins": 1,
      "unknownResolutions": 0,
      "revenuesProxy": "1000000000000000000",
      "responseTimeBlocksAvg": 12,
      "lastActivityBlock": 123456,
      "rates": {
        "successRate": {"value": 5000, "valueDecimals": 2},
        "disputeRate": {"value": 0, "valueDecimals": 2}
      },
      "evidence": {"anchors": []}
    }
  },
  "validators": {
    "0xvalidator": {
      "approvals": 3,
      "disapprovals": 1,
      "disputesTriggered": 0,
      "reputationUpdates": 1,
      "reputationGain": "5",
      "latestReputation": "42",
      "lastActivityBlock": 123450,
      "evidence": {"anchors": []}
    }
  }
}
```

## ERC‑8004 reputation‑v1 output
Each subject file includes:
- `type`: `"https://eips.ethereum.org/EIPS/eip-8004#reputation-v1"`
- `agentRegistry`: `{namespace}:{chainId}:{identityRegistry}` (e.g., `eip155:1:0x...`)
- `agentId`: registry token id for the subject
- `feedback[]`: entries with `clientAddress`, `tag1`, `tag2`, `value`, `valueDecimals`, `reason`, `timestamp`

## Notes
- `revenuesProxy` is the sum of job `payout` values for completed jobs. This is a **proxy** for actual transfers.
- Resolution strings are treated case‑insensitively and mapped to `agent win` / `employer win`.
- `reputationGain` is best‑effort and only covers updates within the specified block range.
