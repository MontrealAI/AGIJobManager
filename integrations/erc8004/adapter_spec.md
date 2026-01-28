# Adapter spec: AGIJobManager → ERC-8004 metrics

This adapter reads AGIJobManager events over a block range and aggregates **per-agent** reputation metrics, with optional **per-validator** aggregates.

## Event → metric mapping
- `JobCreated(jobId, ...)`
  - Employer addresses are recorded for the “trusted client set.”
- `JobApplied(jobId, agent)`
  - Increments `jobsApplied` and `jobsAssigned` for the agent (AGIJobManager assigns on apply).
- `JobCompleted(jobId, agent, ...)`
  - Increments `jobsCompleted` for the agent.
  - Adds `job.payout` (proxy for revenue) to `revenuesProxy`.
- `JobDisputed(jobId, ...)`
  - Increments `jobsDisputed` for the assigned agent.
- `DisputeResolved(jobId, resolution)`
  - Increments `agentWins`, `employerWins`, or `unknownResolutions` for the assigned agent depending on the resolution string.
- `JobValidated(jobId, validator)` (optional)
  - Increments `jobsValidated` for the validator.
- `JobDisapproved(jobId, validator)` (optional)
  - Increments `jobsDisapproved` for the validator.

## Computed rates
Rates are expressed as percentages with `valueDecimals=2` (basis points of percent):
- `successRate` = `jobsCompleted / jobsAssigned * 100`
- `disputeRate` = `jobsDisputed / jobsAssigned * 100`

If `jobsAssigned` is 0, rates are omitted.

## Output schema (intermediate JSON)
```json
{
  "version": "0.1",
  "metadata": {
    "chainId": 11155111,
    "network": "sepolia",
    "fromBlock": 0,
    "toBlock": 123456,
    "generatedAt": "2024-05-01T00:00:00.000Z",
    "sourceContract": "0x...",
    "adapterVersion": "0.1.0"
  },
  "trustedClientSet": {
    "criteria": "addresses that created paid jobs in range",
    "addresses": ["0x..."]
  },
  "agents": {
    "0xAgent": {
      "jobsApplied": 2,
      "jobsAssigned": 2,
      "jobsCompleted": 1,
      "jobsDisputed": 0,
      "employerWins": 0,
      "agentWins": 1,
      "unknownResolutions": 0,
      "revenuesProxy": "1000000000000000000",
      "rates": {
        "successRate": {"value": 5000, "valueDecimals": 2},
        "disputeRate": {"value": 0, "valueDecimals": 2}
      }
    }
  },
  "validators": {
    "0xValidator": {
      "jobsValidated": 3,
      "jobsDisapproved": 1
    }
  }
}
```

## Notes
- `revenuesProxy` is the sum of job `payout` values for completed jobs. This is a **proxy** for actual transfers.
- Resolution strings are treated case-insensitively and mapped to `agent win` / `employer win`.
