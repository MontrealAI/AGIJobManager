# Security Model

## Threats addressed
- Phishing/malicious URIs from on-chain string fields.
- RPC degradation causing stale or partial reads.
- Blind transaction signing and role confusion.

## Controls
- **simulation-first** write flow with explicit preflight checks.
- URI allowlist (`https://`, `http://`, `ipfs://`, `ens://`) and blocked dangerous schemes.
- Strict security headers and IPFS-safe meta policy (CSP with `object-src 'none'`, `frame-ancestors 'none'`, no `unsafe-eval`, plus nosniff, strict referrer policy, locked permissions policy).
- Degraded RPC banner + retry path while preserving read-only navigation.

## Limits
Simulation-first reduces avoidable reverts but does not guarantee liveness, mempool inclusion, or immunity to chain reorgs.
