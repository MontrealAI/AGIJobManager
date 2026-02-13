# Integrations

## ENS / NameWrapper gating

- Eligibility checks may rely on ENS root nodes and NameWrapper ownership checks.
- Additional allowlists and Merkle proofs provide fallback/operator override paths.
- ENS failures should not compromise escrow safety, only identity-gated participation.

## ENSJobPages hooks and tokenURI

- Hook calls are best-effort and emitted via `EnsHookAttempted`.
- `tokenURI` enrichment through ENSJobPages is optional and must not be treated as consensus-critical.

## Merkle allowlists

- Validator and agent Merkle roots are owner-managed via `updateMerkleRoots`.
- Proof tooling: `scripts/merkle/generate_merkle_proof.js` and `scripts/merkle/smoke_test.js`.

> **Operator note**
> Maintain an audit trail whenever root nodes, Merkle roots, or additional allowlist entries change.
