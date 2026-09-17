# Security Model

## Hosted application script policy

The Next.js application generates a fresh, unpredictable CSP nonce for each request. Middleware overwrites incoming nonce/policy headers, Next.js applies the nonce to framework scripts, and the theme provider receives the same nonce. Production script policy does not allow `unsafe-inline` or `unsafe-eval`. Pages render dynamically so a cached static response cannot reuse a nonce. Keep these HTML responses out of shared CDN caches. The downloadable standalone consoles use their own embedded policies.

Browser regressions check both successful application rendering and rejection of an injected untrusted inline script. See the [Next.js CSP guidance](https://nextjs.org/docs/app/guides/content-security-policy).

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
