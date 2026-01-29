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

### ERC-8004 registration schema (required fields)
The registration file MUST use:
```json
{"type":"https://eips.ethereum.org/EIPS/eip-8004#registration-v1"}
```
Required fields:
- `name`, `description`, `image`
- `services[]` (endpoint descriptors with at least `name` + `endpoint`)
- `x402Support` (boolean)
- `active` (boolean)
- `registrations[]` with `{ agentId, agentRegistry }`

`agentRegistry` uses the CAIP-style format:
```
{namespace}:{chainId}:{identityRegistry}
```
Example: `eip155:1:0x742...`

Optional fields:
- `supportedTrust` (if omitted, treat as discovery-only)

**Endpoint-domain verification**: host
```
https://{endpoint-domain}/.well-known/agent-registration.json
```
so clients can verify `agentRegistry` + `agentId` bindings.

### ERC-8004 “services” mapping
Per EIP-8004, agent registration files include a top-level `services` array. Each entry is a flexible endpoint descriptor with a `name`, `endpoint`, and optional `version`.

**Recommended services** (AGIJobManager ecosystem):
- `web`, `A2A`, `MCP`
- `ENS`
- `DID`
- `email`
- `agentWallet` (payments)

> The adapter itself only reads on-chain events. Identity registration is supplied by the agent/validator using ERC-8004 registration registries. For `agentWallet`, registries may expose `setAgentWallet` / `unsetAgentWallet` functions (see https://8004.org/build for the latest ABI).

## 2) Reputation export rules (execution → signals)

### Core aggregates (per agent)
The adapter aggregates the following from AGIJobManager events:
- `assignedCount` — number of `JobApplied` events (assignment on apply)
- `completionRequestedCount` — number of `JobCompletionRequested` events
- `completedCount` — number of `JobCompleted` events
- `disputedCount` — number of `JobDisputed` events
- `agentWinCount` / `employerWinCount` / `unknownResolutionCount` — derived from `DisputeResolved` resolution strings
- `revenuesProxy` — sum of `job.payout` for completed jobs (proxy only)
- `responseTime` — seconds from assignment → completion request / completed (best-effort)
- `blocktimeFreshness` — blocks since last activity in the range

### Rate definitions
Rates are exported in ERC-8004’s fixed-point format (`value`, `valueDecimals`, with `valueDecimals` ∈ [0,18] per the spec):
- `successRate` = `completedCount / assignedCount * 100`
- `disputeRate` = `disputedCount / assignedCount * 100`

Example encoding (aligned to EIP-8004):
- successRate 99.80% → `value=9980`, `valueDecimals=2`
- downvote −1 → `value=-1`, `valueDecimals=0`
- revenues 556000 → `value=556000`, `valueDecimals=0`

### Tag conventions
Recommended `tag1` values when publishing feedback:
- `successRate`
- `disputeRate`
- `responseTime`
- `blocktimeFreshness`
- `revenues`
- `ownerVerified`, `reachable`, `uptime` (external observation)

`tag2` defaults to `observer` for adapter-generated metrics. External raters may use `user`/`watcher`/`ranker` or empty, per the spec.

### Proof-of-payment
When available, `proofOfPayment` is included for `revenues` using the `JobCompleted` anchor (tx hash + log index).

## 3) Validation export rules (validator outcomes → validation signals)

ERC-8004 includes a **validation registry** that records *requests* and *responses*. We map AGIJobManager validator outcomes **off-chain** to validation-like artifacts that can be submitted later without affecting settlement:
- `JobValidated` → validation response with `response=100` (passed)
- `JobDisapproved` → validation response with `response=0` (failed)
- `DisputeResolved` → optional validation tag (e.g., `jobDisputeResolution`) tied to the same request hash

**Request hash suggestion** (off-chain only):
```
requestHash = keccak256(chainId, contractAddress, jobId, eventTxHash)
```

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

## Version alignment
Always confirm the latest schema/ABI details at https://8004.org/build and https://eips.ethereum.org/EIPS/eip-8004.
