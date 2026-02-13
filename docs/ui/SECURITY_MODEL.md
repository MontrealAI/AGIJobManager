# UI Security Model

- Simulation-first transaction pipeline to reduce reverted writes.
- Safe URI sanitizer blocks `javascript:`, `data:`, `file:`, and `blob:`.
- Strict headers/CSP configured in Next config.
- Read-only pages operate without wallet.
- Degraded RPC banner and retry path exposed.

## Non-goals

- UI cannot protect against compromised wallets, malicious RPC consensus attacks, or social engineering outside the app.
