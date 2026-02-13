# Security Model

## UI Threat model
- Malicious URIs from on-chain metadata.
- RPC degradation / stale reads.
- Wallet rejection and custom revert errors.
- Role confusion for privileged actions.

## Controls
- Simulation-first transaction flow and decoded custom errors.
- URI sanitizer allowlisting `https/http/ipfs/ens` and blocking dangerous schemes.
- Strict headers: CSP, frame-ancestors none, nosniff, strict referrer, tight permissions policy.
- Read-only default and role-gated action rendering.
- Degraded RPC banner with retry.

## Not protected by UI
- Smart-contract vulnerabilities.
- Compromised wallets/signing devices.
- Malicious RPC infrastructure returning consistent lies.
