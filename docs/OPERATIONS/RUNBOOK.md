# Operations Runbook

## Start here if you are
- **Owner/operator:** perform checklisted parameter/incident actions and record tx hashes.
- **ENS cutover operator:** establish dedicated-root ownership and both new manager/helper pointers; follow the [cutover plan](../qualification/USDC_CUTOVER.md) and preserve original jobs/wiring.

## ENS cutover expected result
- `AGIJobManager.ensJobPages` points to the new ENSJobPages address.
- ENS Registry reports NameWrapper as owner of the dedicated root; NameWrapper reports the new helper as wrapped-token owner. The qualified route uses no new token or blanket operator approval.
- Creation, actual delegated writes and terminal revocation succeed without skipped/failed ENS hooks.
- Fresh deployment tooling uses `job-<jobId>` under a root derived from chain ID and full manager address; [check the namespace plan](../ENS/DEPLOYMENT_NAMESPACES.md). Replacement keeps the same manager's existing root and prefix.
- Legacy jobs and labels remain on their original manager/helper; same-manager helper replacement migrations are separately reviewed.

## Never do this by accident
- Do not lock identity/config before validating all addresses and operational wiring.
- Do not assume ENS hook success is required for protocol settlement success.

## Parameter change checklist

1. Validate intent and blast radius.
2. Run `node scripts/ops/validate-params.js --network <network> --address <AGIJobManager>` against the target deployment.
3. Stage in testnet and review event output.
4. Execute owner transaction set.
5. Confirm events (`*Updated`) and post-change getters.
6. Record change ticket with tx hashes and rationale.

## Moderator dispute playbook

- Collect evidence (job spec, completion URI, validator votes, timestamps).
- Select `resolutionCode` and reason string.
- Execute `resolveDisputeWithCode`.
- Verify `DisputeResolvedWithCode` emission and terminal state.
- Archive audit trail.

## Operator controls

| Control | Intended usage | Caution |
| --- | --- | --- |
| `pauseIntake()` / `pause()` | Stop new jobs while safe existing work settles | Leaves settlement enabled unless separately paused |
| `pauseAll()` | Contain an active exploit affecting funds | Verify both intake and settlement flags; follow the incident playbook |
| `setSettlementPaused(true)` | Stop new settlement-sensitive paths while preserving controlled operations | Use with communication plan |
| `blacklistAgent/Validator` | Isolate malicious actor | Requires case file evidence |
| `lockIdentityConfiguration()` | Permanently freeze ENS/wrapper/root/helper wiring after validation; USDC is independently immutable | Irreversible |
