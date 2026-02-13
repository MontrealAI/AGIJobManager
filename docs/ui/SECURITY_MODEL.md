# Security Model

- Threats: malicious URIs, RPC faults, wallet simulation mismatch, social phishing.
- Controls: URI allowlist (`https/http/ipfs/ens`), simulation-first writes, degraded-RPC banner, strict response headers.
- Non-goals: backend custody, required indexer, trustless governance.
