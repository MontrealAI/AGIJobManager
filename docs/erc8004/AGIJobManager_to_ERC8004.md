# AGIJobManager → ERC-8004 mapping spec (human-friendly)

This document defines how AGIJobManager execution outcomes map to ERC-8004 identity, reputation, and validation signals **without touching on-chain contract logic**. It implements the control-plane ↔ execution-plane separation required by the trust-layer architecture.

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
Per EIP-8004 and the best-practices Registration guide, agent registration files include a top-level `services` array. Each entry is a flexible **endpoint descriptor** with a `name`, `endpoint`, and optional `version`.

**Recommended representation** (AGI.Eth identity):
| AGI.Eth role | Example name | ERC-8004 service entry (`services[]`) | Notes |
| --- | --- | --- | --- |
| `agent` | `alpha.agent.agi.eth` | `{ "name": "ENS", "endpoint": "alpha.agent.agi.eth", "version": "v1" }` | Primary agent identity for AGIJobManager. |
| `club` | `alpha.club.agi.eth` | `{ "name": "ENS", "endpoint": "alpha.club.agi.eth", "version": "v1" }` | Validator identity (club = validator). |
| `node` | `alpha.node.agi.eth` | `{ "name": "ENS", "endpoint": "alpha.node.agi.eth", "version": "v1" }` | Node identity for infrastructure / routing. |

**Additional recommended services**:
- `agentWallet` (payments): `{ "name": "agentWallet", "endpoint": "eip155:1:0x..." }`
- `MCP` and/or `A2A` endpoints for agent communication

> The adapter itself only reads on-chain events. Identity registration is supplied by the agent/validator using ERC-8004 registration registries.

## 2) Reputation export rules (execution → signals)

### Core aggregates (per agent)
The adapter aggregates the following from AGIJobManager events:
- `jobsAssigned` — number of `JobApplied` events (assignment on apply)
- `jobsCompletionRequested` — number of `JobCompletionRequested` events
- `jobsCompleted` — number of `JobCompleted` events
- `jobsDisputed` — number of `JobDisputed` events
- `agentWins` / `employerWins` / `unknownResolutions` — derived from `DisputeResolved` resolution strings
- `revenuesProxy` — sum of `job.payout` for completed jobs (proxy only)

### Rate definitions
Rates are exported in ERC-8004’s fixed-point format (`value`, `valueDecimals`):
- `successRate` = `jobsCompleted / jobsAssigned * 100`
- `disputeRate` = `jobsDisputed / jobsAssigned * 100`

Example encoding (aligned to EIP-8004):
- successRate 99.80% → `value=9980`, `valueDecimals=2`
- downvote −1 → `value=-1`, `valueDecimals=0`
- revenues $556,000 → `value=556000`, `valueDecimals=0`

### Tag conventions (best-practices-aligned)
Recommended `tag1` values when publishing feedback:
- `successRate`
- `uptime`
- `responseTime`
- `blocktimeFreshness`
- `revenues`
- `ownerVerified`

## 3) Validation export rules (validator outcomes → validation signals)

ERC-8004 includes a validation registry (requests + responses). We map AGIJobManager validator outcomes **off-chain** to validation-like artifacts:
- `JobValidated` → validation response with `response=100` (passed)
- `JobDisapproved` → validation response with `response=0` (failed)
- `DisputeResolved` → optional validation tag (e.g., `jobDisputeResolution`) tied to the same request hash

**Request hash suggestion** (off-chain only):
```
requestHash = keccak256(chainId, contractAddress, jobId, eventTxHash)
```
This keeps validation artifacts anchored to a specific on-chain job outcome without coupling settlement to external calls.

## 4) Trusted rater set guidance (sybil resistance)
A recommended policy for trusted raters is:
- **Eligible raters are addresses that created paid jobs** (`JobCreated` with `payout > 0`).

This is a **policy choice**, not a protocol guarantee. Indexers/rankers should document and enforce their own trusted rater sets.

## 5) Evidence model (auditable anchors)
Every exported signal must be traceable to on-chain anchors. The adapter outputs:
- `txHash`, `logIndex`, `blockNumber`, `contractAddress`, `chainId`

Heavy data (full job details, external proofs, or explanation text) stays **off-chain** and can be referenced by hash if needed.

## 6) Separation rationale (control plane vs execution plane)
- **ERC-8004**: publish minimal, verifiable trust signals.
- **AGIJobManager**: escrow, settlement, validation, and dispute enforcement.
- **Invariant**: no payout without validated proof; no settlement without validation.

This mapping preserves liveness by preventing any ERC-8004 dependency from gating escrow finalization.

## Version alignment
Aligned to EIP-8004 and the ERC-8004 best-practices Registration/Reputation guides as of **2026-01-29**.
