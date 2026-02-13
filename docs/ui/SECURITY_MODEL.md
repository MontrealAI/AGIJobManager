# Security Model

Threats addressed:
- Phishing links from untrusted URI fields are blocked unless scheme is allowlisted (`https`, `http`, `ipfs`, `ens`).
- RPC faults surface degraded banner + retry controls.
- Wallet failures decode custom errors to human messages.
- Simulation mismatch is mitigated by simulation-first write path and explicit stepper states.

Non-goals / residual risks:
- No backend custody or required off-chain database.
- No guarantee against chain reorgs or third-party RPC censorship.
