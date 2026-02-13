# UI Runbook

## Mainnet checklist
1. Verify chain id and addresses in `.env.local`.
2. Confirm read-only pages load without wallet.
3. Execute simulation-first write dry run.
4. Validate pause and settlement pause banners.

## Incident checklist
1. Switch to degraded mode messaging if RPC unstable.
2. Pause dangerous operations in ops console.
3. Export job table CSV for audit handoff.
