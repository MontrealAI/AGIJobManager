# Security Model

## Threat model summary
This protocol is intentionally owner-operated and moderator-assisted, not a trustless court.

### Trusted parties
- Owner: extensive operational authority.
- Moderators: dispute outcome authority for active disputes.
- Validators: permissioned participation with economic bonding.

### Main trust assumptions
- Owner behaves within documented operating policy.
- Moderator set is controlled and monitored.
- AGI ERC-20 behaves compatibly with strict transfer checks.
- ENS components can fail independently without needing to halt settlement.

## Core safety properties
- Escrow and all active bonds are represented in locked accounting buckets.
- Treasury withdrawal excludes locked totals and reverts on insolvency checks.
- Settlement paths release/reallocate locked balances rather than creating hidden liabilities.
- Vote loops and AGIType loops are bounded (`MAX_VALIDATORS_PER_JOB`, `MAX_AGI_TYPES`).

## Centralization and governance posture
- Owner can pause/unpause and tune parameters.
- Owner controls allowlists/blacklists and identity wiring until lock.
- Owner can stale-resolve disputes after timeout.

## Known limitations
- Not upgradeable by proxy in this repo.
- ENS hooks are best-effort (metadata consistency may lag or fail).
- Validator participation is permissioned and can be a liveness bottleneck.
- No built-in decentralized appeals beyond moderator/owner roles.

## Non-goals
- No internal NFT marketplace.
- No on-chain ERC-8004 implementation.
- No fully decentralized governance layer in this repository.

## Vulnerability reporting
Follow [SECURITY.md](../SECURITY.md). Do not disclose exploitable details in public issues.
