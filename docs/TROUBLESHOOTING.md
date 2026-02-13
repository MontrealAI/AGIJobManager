# Troubleshooting

| Symptom | Likely cause | Remedy |
| --- | --- | --- |
| `InvalidState` revert | Function called in wrong lifecycle phase | Inspect `getJobCore` + `getJobValidation` and retry in valid state |
| `SettlementPaused` revert | Owner enabled settlement pause | Coordinate with operator; consult incident channel |
| Validator cannot vote | Not eligible via allowlist/Merkle/ENS or blacklisted | Verify proof/root, allowlist status, blacklist flags |
| Finalize fails | Challenge/review window not elapsed or unsettled dispute | Recompute timestamps; resolve dispute first |
| Withdraw fails with insufficient withdrawable | Locked escrow/bonds exceed treasury headroom | Reconcile locked accounting and pending settlements |
| ENS hook errors | External ENS/Resolver/ENSJobPages issue | Treat as best-effort signal; do not infer fund risk |
