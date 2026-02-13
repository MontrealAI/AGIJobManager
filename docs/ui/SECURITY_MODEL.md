# Security Model

- Simulation-first transaction pipeline.
- URI safety allowlist: https/http/ipfs/ens only.
- CSP + frame-ancestors none + strict headers.
- Role-gated actions and read-only fallback.
- Degraded RPC banner with retry.

UI does **not** protect against malicious wallets, compromised RPC providers, or user signing unsafe tx in external tools.
