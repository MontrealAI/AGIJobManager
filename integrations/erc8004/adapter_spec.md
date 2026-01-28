# AGIJobManager → ERC-8004 adapter spec

This adapter consumes AGIJobManager events and computes per-agent (and optional per-validator) metrics. The output is a JSON artifact suitable for ERC-8004 reputation publishing workflows.

## Event mapping
| AGIJobManager event | Derived metric | Notes |
| --- | --- | --- |
| `JobApplied(jobId, agent)` | `jobsApplied`, `jobsAssigned` | In this contract, applying assigns the agent. |
| `JobCompleted(jobId, agent, reputationPoints)` | `jobsCompleted`, `revenues` | Revenue is **proxy** sum of job payouts from `JobCreated` events. |
| `JobDisputed(jobId, disputant)` | `jobsDisputed` | Counted once per jobId (deduped) against the assigned agent. |
| `DisputeResolved(jobId, resolver, resolution)` | `agentWins`, `employerWins`, `unknownResolutions` | Resolution string normalized to `agent win` / `employer win`. |
| `JobValidated(jobId, validator)` | `validatorApprovals` | Only computed if `INCLUDE_VALIDATORS=true`. |
| `JobDisapproved(jobId, validator)` | `validatorDisapprovals` | Only computed if `INCLUDE_VALIDATORS=true`. |

## Computed rates
- **successRate** = `jobsCompleted / jobsAssigned`
- **disputeRate** = `jobsDisputed / jobsAssigned`

Rates are emitted as integers with `valueDecimals=2` so `99.80%` becomes `value=9980`.

## Recommended tag1 values
These tags align with ERC-8004 best practices and are intended to be paired with `value`/`valueDecimals` in downstream publishing workflows:
- `successRate`
- `disputeRate`
- `jobsCompleted`
- `jobsAssigned`
- `agentWins`
- `employerWins`
- `revenues`
- `ownerVerified`
- `uptime`
- `responseTime`
- `blocktimeFreshness`

## Output JSON structure (summary)
```json
{
  "metadata": {
    "chainId": 11155111,
    "networkId": 11155111,
    "network": "sepolia",
    "fromBlock": 0,
    "toBlock": "latest",
    "generatedAt": "2025-01-01T00:00:00Z",
    "sourceContract": "0x...",
    "adapterVersion": "1.0"
  },
  "agents": [
    {
      "address": "0x...",
      "totals": {
        "jobsApplied": 3,
        "jobsAssigned": 3,
        "jobsCompleted": 2,
        "jobsDisputed": 1,
        "agentWins": 1,
        "employerWins": 0,
        "unknownResolutions": 0,
        "revenues": { "value": "1500000000000000000", "valueDecimals": 0 }
      },
      "rates": {
        "successRate": { "value": 6667, "valueDecimals": 2 },
        "disputeRate": { "value": 3333, "valueDecimals": 2 }
      }
    }
  ],
  "validators": []
}
```
