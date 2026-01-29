# Adapter spec: AGIJobManager → ERC-8004 reputation files

This adapter reads AGIJobManager events over a block range and aggregates **per-agent** reputation metrics, with optional **per-validator** aggregates. It emits **ERC-8004 `reputation-v1` files** (or a documented wallet-address placeholder when `agentId` is unknown).

## Event → metric mapping
- `JobCreated(jobId, ...)`
  - Employer addresses are recorded for the “trusted client set” (addresses that created paid jobs).
- `JobApplied(jobId, agent)`
  - Increments `assignedCount` for the agent.
  - Marks the assignment timestamp for response-time proxy.
- `JobCompletionRequested(jobId, agent)`
  - Increments `completionRequestedCount` for the agent.
  - Computes response-time proxy from assignment → completion requested (seconds).
- `JobCompleted(jobId, agent, ...)`
  - Increments `completedCount` for the agent.
  - Adds `job.payout` (proxy for revenue) to `revenuesProxy`.
  - Computes response-time proxy from assignment → completed (seconds) when no completion request was observed.
- `JobDisputed(jobId, ...)`
  - Increments `disputedCount` for the assigned agent.
- `DisputeResolved(jobId, resolution)`
  - Increments `agentWinCount`, `employerWinCount`, or `unknownResolutionCount` depending on the resolution string.
- `JobValidated(jobId, validator)` (optional)
  - Increments `validationsCount` for the validator.
- `JobDisapproved(jobId, validator)` (optional)
  - Increments `disapprovalsCount` for the validator.
- `ReputationUpdated(user, newReputation)` (optional)
  - If `user` is a known validator in-range, increments `reputationUpdates` and updates `latestReputation`.
  - `reputationGain` sums **positive deltas** between consecutive updates observed in-range (best-effort proxy only).

## Computed rates
Rates are expressed as percentages with `valueDecimals=2` (basis points of percent):
- `successRate` = `completedCount / assignedCount * 100`
- `disputeRate` = `disputedCount / assignedCount * 100`
- `approvalRate` = `validationsCount / (validationsCount + disapprovalsCount) * 100` (validators only)
- `disapprovalRate` = `disapprovalsCount / (validationsCount + disapprovalsCount) * 100` (validators only)

If the denominator is 0, the rate is omitted. Rounding is deterministic (half-up integer math).

## Feedback encoding (ERC-8004)
Each emitted file follows:
```json
{
  "type": "https://eips.ethereum.org/EIPS/eip-8004#reputation-v1",
  "agentRegistry": "{namespace}:{chainId}:{identityRegistry}",
  "agentId": 123,
  "feedback": [
    {
      "clientAddress": "0x...",
      "tag1": "successRate",
      "tag2": "observer",
      "value": 9980,
      "valueDecimals": 2,
      "reason": "Computed from AGIJobManager events 0-1000.",
      "timestamp": 1735689600,
      "proofOfPayment": { "txHash": "0x...", "logIndex": 1, "blockNumber": 123, "event": "JobCompleted", "jobId": "1" }
    }
  ]
}
```

### Tag guidance (AGIJobManager)
Recommended `tag1` values:
- `successRate` (derived from events)
- `disputeRate` (derived from events)
- `responseTime` (seconds; assignment → completion request or completion)
- `blocktimeFreshness` (blocks since last activity)
- `revenues` (proxy from payouts)
- `ownerVerified`, `reachable`, `uptime` (require external observation)

`tag2` is set to `observer` by default for adapter-generated metrics. External raters may use `user`/`watcher`/`ranker` or empty according to the EIP-8004 guidance.

## Identity mapping (agentId lookup strategy)
AGIJobManager does not know ERC-8004 agent IDs. The adapter supports:
1) **Explicit override**: set `ERC8004_AGENT_ID` (+ optional `AGENT_ADDRESS` for single-subject runs).
2) **Mapping file**: set `ERC8004_AGENT_ID_MAP=/path/to/map.json` with `{ "0xagent": 1 }`.
3) **External lookup**: use official ERC-8004 registry tooling (from https://8004.org/build) to resolve wallet → agentId, then supply the mapping file.

If no mapping is available, the adapter emits `*.wallet.json` placeholders keyed by wallet address. Replace these with `reputation-v1` files once agent IDs are known.

## Evidence anchors
Every metric bundle includes `evidence.anchors[]` with:
- `txHash`, `logIndex`, `blockNumber`
- `event`, `jobId`
- `contractAddress`, `chainId`

Heavy data stays off-chain; anchors are sufficient to re-derive metrics.

## Output summary (export_summary.json)
```json
{
  "version": "0.3",
  "metadata": {
    "chainId": 11155111,
    "network": "sepolia",
    "contractAddress": "0x...",
    "fromBlock": 0,
    "toBlock": 123456,
    "generatedAt": "2026-01-29T00:00:00.000Z",
    "toolVersion": "agijobmanager-erc8004-adapter@0.1.0"
  },
  "agentRegistry": "eip155:11155111:0x...",
  "trustedClientSet": { "criteria": "addresses that created paid jobs in range", "addresses": ["0x..."] },
  "subjects": {
    "agents": {
      "0xagent": {
        "agentId": 1,
        "assignedCount": 2,
        "completedCount": 1,
        "disputedCount": 0,
        "successRate": { "value": 5000, "valueDecimals": 2 },
        "disputeRate": { "value": 0, "valueDecimals": 2 },
        "file": "agent_0xagent.json"
      }
    }
  }
}
```

## Notes
- `revenues` is a **proxy** (sum of `job.payout` for completed jobs), not necessarily net transfers.
- `responseTime` and `blocktimeFreshness` are best-effort and depend on observed events in the specified block range.
