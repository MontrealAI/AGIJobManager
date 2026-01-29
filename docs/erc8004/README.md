# ERC-8004 integration (control plane ↔ execution plane)

This repository treats **ERC-8004** as the *trust-signaling control plane* (Identity • Reputation • Validation), and **AGIJobManager** as the *execution + settlement plane* (AuthZ gate • escrow • quorum validation • disputes • reputation accounting). The integration is intentionally **off-chain** and **non-blocking**: no payout or finalization path depends on external ERC-8004 calls.

## Canonical framing (internal sources)
The architectural intent in this repo aligns with the internal decks:
- **MONTREAL.AI × ERC-8004 Full-Stack Trust Layer** (`presentations/MONTREALAI_x_ERC8004_v0.pdf`)
- **AGI.Eth Namespace + AGI Jobs v0 institutional brief** (`presentations/AGI_Eth_Institutional_v0.pdf`)

These sources emphasize **signaling vs enforcement** and the invariant mindset: **no payout without validated proof; no settlement without validation**.

## What ERC-8004 provides (and what it does not)
**ERC-8004 is a set of registries** for *identity (registration)*, *reputation (feedback)*, and *validation* signals. The registries intentionally store **minimal, verifiable data** (addresses, tags, fixed-point values, and URIs) and **do not** store heavy data, settlement logic, or escrow outcomes. This makes it a **signaling layer** that complements AGIJobManager’s enforcement plane.

**What it stores**
- **Registration**: agent metadata + a `services[]` array of endpoints (e.g., MCP, A2A, ENS).
- **Reputation**: compact trust signals (`value` + `valueDecimals`) with optional `tag1`/`tag2`, `endpoint`, and evidence URIs/hashes.
- **Validation**: requests and responses that can be anchored to on-chain outcomes.

**What it intentionally does not store**
- Escrow balances, payout logic, or dispute outcomes.
- Large evidence payloads (these stay off-chain and are referenced by hash/URI).
- Any liveness requirement that would gate AGIJobManager settlement.

## External references (source of truth)
Always verify the latest contract addresses, ABI, and examples before submitting on‑chain feedback:
- https://www.8004.org/
- https://www.8004.org/build
- https://eips.ethereum.org/EIPS/eip-8004
- https://ai.ethereum.foundation/blog/intro-erc-8004

## Quick links
- **Mapping spec**: [`AGIJobManager_to_ERC8004.md`](AGIJobManager_to_ERC8004.md)
- **Threat model**: [`ThreatModel.md`](ThreatModel.md)
- **Adapter spec & examples**: [`integrations/erc8004/`](../../integrations/erc8004)

## Why the separation matters
- **ERC-8004 is signaling**: publish minimal, verifiable trust signals for indexing, ranking, and policy formation.
- **AGIJobManager is enforcement**: settle escrow, apply dispute outcomes, and account for reputation without external dependencies.
- **No liveness dependency**: AGIJobManager does not wait for ERC-8004 registries, indexers, or feedback submissions.

The adapter translates **execution outcomes** into portable ERC-8004-friendly signals without coupling settlement to external calls.
Signals should remain **minimal and auditable**: keep heavy data off-chain and anchor it by `txHash`, `logIndex`, `blockNumber`, `contractAddress`, and `chainId` references in exported artifacts.
