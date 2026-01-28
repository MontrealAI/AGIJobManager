# Integrations overview

This document summarizes integration points for AGIJobManager, including allowlist checks and off-chain reputation tooling.

## Access control integrations
- **Merkle allowlists**: agents and validators can be authorized by Merkle proofs over their address.
- **ENS ownership checks**: `_verifyOwnership` attempts NameWrapper and resolver lookups for a subdomain under the configured root node.
- **Explicit allowlists**: the owner can add or remove `additionalAgents` and `additionalValidators` to bypass Merkle or ENS checks.

Events to watch:
- `OwnershipVerified` indicates a successful ownership check.
- `RecoveryInitiated` indicates an ENS or NameWrapper failure path.

## ERC‑8004 off-chain adapter
AGIJobManager keeps escrow settlement fully on-chain and does **not** depend on any ERC‑8004 contract. The repository provides an off-chain adapter that maps job events into ERC‑8004 reputation signals.

- Adapter documentation: [`docs/ERC8004.md`](ERC8004.md)
- Adapter implementation: [`integrations/erc8004/`](../integrations/erc8004/)

## Indexing guidance
Indexers should prioritize job lifecycle events and NFT issuance events (see `docs/Interface.md` for the canonical list). Most job events are not indexed; downstream systems should scan by block range and store their own derived indices.
