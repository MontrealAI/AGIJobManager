# ERC-8004 integration (control plane ↔ execution plane)

This repository treats **ERC-8004** as the *trust-signaling control plane* (Identity • Reputation • Validation), and **AGIJobManager** as the *execution + settlement plane* (AuthZ gate • escrow • quorum validation • disputes • reputation accounting). The integration is intentionally **off-chain** and **non-blocking**: no payout or finalization path depends on external ERC-8004 calls.

## Canonical framing (internal sources)
The architectural intent in this repo aligns with the internal decks:
- **MONTREAL.AI × ERC-8004 Full-Stack Trust Layer** (`presentations/MONTREALAI_x_ERC8004_v0.pdf`)
- **AGI.Eth Namespace + AGI Jobs v0 institutional brief** (`presentations/AGI_Eth_Institutional_v0.pdf`)

These sources emphasize **signaling vs enforcement** and the invariant mindset: **no payout without validated proof; no settlement without validation**.

## External references (verified)
Aligned to the latest public sources as of **2026-01-29**:
- **EIP-8004 spec** (registration uses a `services` array with `name`/`endpoint`/`version`, feedback uses `value` + `valueDecimals`, optional `tag1`/`tag2`, `endpoint`, `feedbackURI`, `feedbackHash`): https://eips.ethereum.org/EIPS/eip-8004
- **ERC-8004 best practices** (Registration + Reputation guides):
  - https://github.com/erc-8004/best-practices/blob/main/Registration.md
  - https://github.com/erc-8004/best-practices/blob/main/Reputation.md
- **Ethereum Foundation intro**: https://ai.ethereum.foundation/blog/intro-erc-8004

## Quick links
- **Mapping spec**: [`AGIJobManager_to_ERC8004.md`](AGIJobManager_to_ERC8004.md)
- **Threat model**: [`ThreatModel.md`](ThreatModel.md)
- **Adapter spec & examples**: [`integrations/erc8004/`](../../integrations/erc8004)

## Why the separation matters
- **ERC-8004 is signaling**: publish minimal, verifiable trust signals for indexing, ranking, and policy formation.
- **AGIJobManager is enforcement**: settle escrow, apply dispute outcomes, and account for reputation without external dependencies.
- **No liveness dependency**: AGIJobManager does not wait for ERC-8004 registries, indexers, or feedback submissions.

The adapter translates **execution outcomes** into portable ERC-8004-friendly signals without coupling settlement to external calls.
