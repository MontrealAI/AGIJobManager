# Security Model

Threats handled:
- Untrusted URIs: only allowlisted schemes are clickable.
- RPC degradation: global degraded banner + retries.
- Wallet/simulation errors: decode custom errors and block unsafe sends.
- Header hardening: CSP, nosniff, referrer policy, permissions policy, frame protection.

Non-goals / residual risk:
- No backend custody or off-chain DB required.
- No trustless governance claim; owner/moderator powers remain explicit.
