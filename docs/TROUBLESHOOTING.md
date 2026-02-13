# Troubleshooting

| Symptom | Likely cause | Remedy |
| --- | --- | --- |
| `InvalidState` revert on lifecycle action | Function called out of lifecycle order | Verify job state via read getters before action |
| `NotAuthorized` / role failures | ENS/Merkle/additional allowlist mismatch | Re-check proofs, root nodes, and additional allowlists |
| Unable to finalize | Challenge window not elapsed or settlement paused | Wait required period or clear pause condition |
| Treasury withdrawal blocked | `withdrawableAGI()` insufficient or contract not paused | Reconcile locked balances and pause before withdrawal |
| Docs check fails as stale | Generated reference files not committed | Run `npm run docs:gen` and commit generated updates |
