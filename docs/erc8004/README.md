# ERC-8004 integration (control plane ↔ execution plane)

This repository treats **ERC-8004** as the *trust-signaling control plane* (Identity • Reputation • Validation), and **AGIJobManager** as the *execution + settlement plane* (AuthZ gate • escrow • quorum validation • disputes • reputation accounting). The integration is intentionally **off-chain** and **non-blocking**: no payout or finalization path depends on external ERC-8004 calls.

## Start here
- **Canonical overview**: [`docs/ERC8004.md`](../ERC8004.md)
- **Mapping spec**: [`docs/erc8004/AGIJobManager_to_ERC8004.md`](AGIJobManager_to_ERC8004.md)
- **Threat model**: [`docs/erc8004/ThreatModel.md`](ThreatModel.md)
- **Adapter spec**: [`integrations/erc8004/adapter_spec.md`](../../integrations/erc8004/adapter_spec.md)
- **Adapter README**: [`integrations/erc8004/README.md`](../../integrations/erc8004/README.md)

## External references (source of truth)
Always verify the latest contract addresses, ABI, and examples before submitting on-chain feedback:
- https://eips.ethereum.org/EIPS/eip-8004
- https://github.com/erc-8004/erc-8004-contracts

## Why the separation matters
- **ERC-8004 is signaling**: publish minimal, verifiable trust signals for indexing, ranking, and policy formation.
- **AGIJobManager is enforcement**: settle escrow, apply dispute outcomes, and account for reputation without external dependencies.
- **No liveness dependency**: AGIJobManager does not wait for ERC-8004 registries, indexers, or feedback submissions.

Signals should remain **minimal and auditable**: keep heavy data off-chain and anchor it by `txHash`, `logIndex`, `blockNumber`, `contractAddress`, and `chainId` references in exported artifacts.
