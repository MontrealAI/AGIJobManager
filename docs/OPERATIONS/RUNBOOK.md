# Operations Runbook

## Start here if you are
- **Owner/operator:** perform checklisted parameter/incident actions and record tx hashes.
- **ENS cutover operator:** complete wrapper approval + `setEnsJobPages` before expecting new hook behavior.

## Never do this by accident
- Do not lock identity/config before validating all addresses and operational wiring.
- Do not assume ENS hook success is required for protocol settlement success.

## Parameter change checklist

1. Validate intent and blast radius.
2. Run `truffle exec scripts/ops/validate-params.js --network <network> --address <AGIJobManager>` against the target deployment.
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
| `pause()` | Emergency stop for broad risk events | Also pauses normal throughput |
| `setSettlementPaused(true)` | Stop new settlement-sensitive paths while preserving controlled operations | Use with communication plan |
| `blacklistAgent/Validator` | Isolate malicious actor | Requires case file evidence |
| `lockIdentityConfiguration()` | Permanently freeze token/ENS/root wiring after hardening | Irreversible |
