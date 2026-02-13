# UI Security Model

## Threat model
- Phishing links in on-chain URIs.
- RPC faults, stale reads, and partial outages.
- User signing unsafe writes without preflight context.

## Controls
- **Read-only first**: walletless rendering for all major pages.
- **Simulation-first writes**: `simulateContract()` before wallet signature.
- **Untrusted strings**: no `dangerouslySetInnerHTML`; URI allowlist only.
- **Headers**: CSP, frame-ancestors none, nosniff, strict referrer policy, locked permissions policy.
- **Resiliency**: react-query retries/backoff + degraded RPC banner.

## Simulation guarantees and limits
Simulation validates contract behavior for current state and calldata, but cannot guarantee:
- state unchanged between simulation and inclusion,
- mempool ordering,
- chain reorg behavior.

Users still receive explicit failure diagnostics with custom error names and next-step guidance.
