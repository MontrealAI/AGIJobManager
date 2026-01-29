# ERC-8004 integration threat model (AGIJobManager)

This threat model focuses on the **off-chain adapter** and the **signaling vs enforcement** separation. AGIJobManager remains the enforcement plane; ERC-8004 is a signaling plane.

## What we gain
- **Portable trust signals** for identity, reputation, and validation that can be indexed by any ERC-8004-aware service.
- **Composability** across catalogs, rankers, insurers, and auditors without modifying the core escrow contract.
- **Auditability**: every exported signal includes on-chain anchors (txHash, logIndex, blockNumber, contractAddress, chainId).

## What we do NOT trust
- **Off-chain computation** is not authoritative for settlement.
- **External indexers/registries** are not liveness dependencies for payouts or dispute resolution.
- **Self-reported metadata** (registration fields) is informational and must be weighted or verified by observers.

## Core safety principle
**No payout without validated proof; no settlement without validation.**

The adapter reads events after settlement is finalized; it never influences on-chain control flow.

## Attack surfaces & mitigations
### 1) Sybil feedback
- **Risk**: attackers can post feedback from many addresses.
- **Mitigation**: establish a trusted rater set (e.g., addresses that created paid jobs) and filter/weight accordingly.
- **Note**: this is a policy choice, not a protocol guarantee.

### 2) Data availability / indexer downtime
- **Risk**: ERC-8004 indexer is down or delayed.
- **Mitigation**: no on-chain dependency; settlement is independent. Off-chain exports can be regenerated later.

### 3) Off-chain data tampering
- **Risk**: metrics file altered.
- **Mitigation**: anchor evidence to on-chain logs (txHash/logIndex), optionally publish a content hash (e.g., IPFS CID or keccak256) in ERC-8004 feedback.

### 4) Metric ambiguity
- **Risk**: different observers compute metrics differently.
- **Mitigation**: adapter spec explicitly defines rates, thresholds, and event mappings. Any alternative policy must document its deviations.

## Residual risks
- **Economic manipulation**: agents could complete low-value jobs to boost counts.
- **Bias**: trusted rater selection can be too strict or too permissive.
- **Context gaps**: on-chain events can’t encode the full job context; heavy data remains off-chain.

## Why off-chain export is safe
- The adapter only **reads** on-chain data and exports it.
- It never triggers on-chain calls during job completion or dispute resolution.
- Signals are **verifiable** and **replayable** by independent observers.
