# Operator runbook

> Current guide for this source checkout. See [release identity and deployment commands](RELEASE_GUIDE.md).

The maintained operational procedure is the [owner runbook](OWNER_RUNBOOK.md). For a separately authorized new deployment, follow [Hardhat](../hardhat/README.md), verify the constructor-assigned governor and zero pending owner, and run read-only readiness before opening intake. Current creation has no handover or acceptance stage; historical records and later voluntary Manager transfers retain two-step acceptance.

| Task | Current procedure |
| --- | --- |
| Stop new work while existing jobs settle | `pauseIntake()`; keep settlement enabled |
| Contain an active fund-moving incident | [Incident response](OPERATIONS/INCIDENT_RESPONSE.md); `pauseAll()` when both lanes must stop |
| Rotate 30%/10% recipients | Paused intake and zero in all four escrow/bond reserves; [owner controls](OWNER_CONTROLS.md) |
| Withdraw genuine surplus | Read `withdrawableUSDC()`; owner, paused intake, settlement enabled |
| Change job/vote policy | [Configuration](CONFIGURATION.md); review per-job snapshots and zero-reserve guards |
| Investigate a delayed job | [Participant guide](USERS.md), [lifecycle](PROTOCOL_FLOW.md), transaction receipt and review/dispute deadlines |

Monitor the USDC balance against `lockedEscrow + lockedAgentBonds + lockedValidatorBonds + lockedDisputeBonds`. Read both pause flags and track actual transaction outcomes. Exact callable functions and events are in the [generated interface](REFERENCE/CONTRACT_INTERFACE.md) and [event reference](REFERENCE/EVENTS_AND_ERRORS.md).

The earlier duplicated runbook is retained in the [v0.8.0 source](https://github.com/MontrealAI/AGIJobManager/blob/v0.8.0/docs/operator-runbook.md) as historical material, not current operational instructions.
