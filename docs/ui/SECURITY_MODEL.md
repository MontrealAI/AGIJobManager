# Security Model

- Simulation-first writes: never blind-send.
- Untrusted URI handling: only allowlisted schemes clickable.
- RPC fault tolerance: retries + degraded banner.
- Header hardening: CSP, frame denial, nosniff, strict referrer, permissions policy.

## Residual risks
- Wallet malware/phishing outside app control.
- RPC censorship can reduce liveness.
- Contract-level bugs remain out-of-scope for frontend mitigations.
