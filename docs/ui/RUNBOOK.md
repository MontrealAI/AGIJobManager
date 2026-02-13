# UI Ops Runbook

1. Verify chain, contract addresses, paused state.
2. Use simulation-first for all writes.
3. During RPC incident, switch provider and keep read-only ops available.
4. For treasury actions, require paused && !settlementPaused and typed confirmation.
