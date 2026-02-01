# AGIJobManager → ERC-8004 mapping spec (human-friendly)

This document defines how AGIJobManager execution outcomes map to ERC-8004 identity and reputation signals **without touching on-chain contract logic**. It preserves the control-plane ↔ execution-plane separation required by the trust-layer architecture.

## 1) Identity mapping (AGI.Eth → ERC-8004 registration)

### AGI.Eth namespace grammar
AGI.Eth names follow:
```
<entity>.(<env>.)<role>.agi.eth
```
Where `role ∈ {club, agent, node}` and `env` is optional (e.g., `alpha`). Examples:
- `alpha.agent.agi.eth`
- `alpha.club.agi.eth`
- `node.agi.eth`

### ERC-8004 registration “services”
Per ERC-8004, the registration file includes a top-level `services[]` array. Each entry is a flexible endpoint descriptor with `name`, `endpoint`, and optional `version`.

**Registration file skeleton (selected fields)**:
- `type`, `name`, `description`, `image` (ERC-721 compatible metadata)
- `services[]` (`name`, `endpoint`, `version`)
- `x402Support`, `active`, `registrations[]`
- `supportedTrust[]` (optional)

**Recommended representation** (AGI.Eth identity):
| AGI.Eth role | Example name | ERC-8004 service entry (`services[]`) | Notes |
| --- | --- | --- | --- |
| `agent` | `alpha.agent.agi.eth` | `{ "name": "ENS", "endpoint": "alpha.agent.agi.eth", "version": "v1" }` | Primary agent identity for AGIJobManager. |
| `club` | `alpha.club.agi.eth` | `{ "name": "ENS", "endpoint": "alpha.club.agi.eth", "version": "v1" }` | Validator identity (club = validator). |
| `node` | `alpha.node.agi.eth` | `{ "name": "ENS", "endpoint": "alpha.node.agi.eth", "version": "v1" }` | Infrastructure / routing identity. |

> The adapter itself only reads AGIJobManager events. Identity registration is supplied by the agent/validator using the ERC-8004 Identity Registry.

## 2) Reputation export rules (execution → signals)

### Core aggregates (per agent)
The adapter aggregates the following from AGIJobManager events:
- `assignedCount` — number of `JobApplied` events (assignment on apply)
- `completedCount` — number of `JobCompleted` events
- `disputedCount` — number of `JobDisputed` events
- `agentWinCount` / `employerWinCount` / `unknownResolutionCount` — derived from `DisputeResolvedWithCode` resolution codes (fallback to legacy `DisputeResolved` strings if needed)
- `grossEscrow` — sum of `job.payout` for completed jobs (raw token units)
- `netAgentPaidProxy` — proxy computed from `grossEscrow * current payoutPercentage / 100`

### Rate definitions
Rates are exported in ERC-8004’s fixed-point format (`value`, `valueDecimals`, with `valueDecimals` ∈ [0,18] per the spec):
- `successRate` = `completedCount / assignedCount * 100`
- `disputeRate` = `disputedCount / assignedCount * 100`

Example encoding (aligned to ERC-8004):
- successRate 99.80% → `value=9980`, `valueDecimals=2`
- downvote −1 → `value=-1`, `valueDecimals=0`
- revenues 556,000 → `value=556000`, `valueDecimals=0`

### Tag conventions (best-practices-aligned)
Recommended `tag1` values when publishing feedback:
- `successRate`
- `disputeRate`
- `grossEscrow`
- `netAgentPaidProxy`
- `blocktimeFreshness`

When publishing feedback, include `feedbackURI` + `feedbackHash` if you want to bind a richer off-chain report (e.g., the exported metrics bundle). For IPFS or other content-addressed URIs, `feedbackHash` can be omitted as permitted by the spec.

## 3) Validation export rules (validator outcomes → signals)

ERC-8004 includes a **validation registry** that records *requests* and *responses*. We **do not** submit AGIJobManager outcomes on-chain by default. Instead, the adapter exports **off-chain** validation-like signals (e.g., approvalRate) that can be submitted later without affecting settlement.

## 4) Trusted rater set guidance (sybil resistance)
A recommended policy for trusted raters is:
- **Eligible raters are addresses that created paid jobs** (`JobCreated` with `payout > 0`).

This is a **policy choice**, not a protocol guarantee. Indexers/rankers should document and enforce their own trusted rater sets.

## 5) Evidence model (auditable anchors)
Every exported signal is traceable to on-chain anchors:
- `txHash`, `logIndex`, `blockNumber`, `contractAddress`, `chainId`

Heavy data (full job details, external proofs, or explanation text) stays **off-chain** and can be referenced by hash if needed.

## 6) Separation rationale (control plane vs execution plane)
- **ERC-8004**: publish minimal, verifiable trust signals.
- **AGIJobManager**: escrow, settlement, validation, and dispute enforcement.
- **Invariant**: no payout without validated proof; no settlement without validation.

This mapping preserves liveness by preventing any ERC-8004 dependency from gating escrow finalization.
