# Security Model

- Simulation-first transaction flow.
- Safe URI allowlist (`https/http/ipfs/ens`) and blocked schemes (`javascript/data/file/blob`).
- Strict response headers (CSP, frame-ancestors none, nosniff, referrer policy).
- Degraded RPC banner with retry.

## Out of scope
- Contract logic correctness.
- User wallet malware/phishing outside this UI.
