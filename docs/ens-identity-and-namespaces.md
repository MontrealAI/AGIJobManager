# ENS identity and namespaces

This document explains the ENS‑based identity grammar used for role gating and
how AGIJobManager enforces agent/validator identity on‑chain.

## Namespace grammar (role identity)

**Pattern (on‑chain gating)**: `<entity>.(<env>.)<role>.agi.eth`
- `role ∈ {club, agent, node}`
- `env ∈ ENV_SET` (optional; examples: `alpha`, `x`, …)

**Contract scope note**: AGIJobManager currently enforces **club** (validators) and **agent** roles only. `node` names are part of the wider namespace grammar and are not consumed by the contract today.

### Examples (env = alpha)
- **Validator (role=club)**: `alice.club.agi.eth` or `alice.alpha.club.agi.eth`
- **Agent (role=agent)**: `helper.agent.agi.eth` or `helper.alpha.agent.agi.eth`
- **Node (role=node)**: `gpu01.node.agi.eth` or `gpu01.alpha.node.agi.eth`

### Sovereigns / businesses (general)
- **Global sovereign**: `<sovereign>.agi.eth`
- **Ecosystem root**: `<env>.agi.eth` (examples: `alpha.agi.eth`, `x.agi.eth`)
- **Business under env**: `<business>.<env>.agi.eth` (example: `ops.alpha.agi.eth`)

**Scope rule**: `entity.env.role.agi.eth` is recognized and developed only within
`env.agi.eth`.

### Environment package concept
**Official environment package (issued by AGI King)** (`env.agi.eth`) includes:
- `env.agi.eth`
- `env.agent.agi.eth`
- `env.node.agi.eth`
- `env.club.agi.eth`

**Optional aliases (env‑local; not official by default)**
- `agent.env.agi.eth`
- `node.env.agi.eth`
- `club.env.agi.eth`

These aliases are recognized **only within** `env.agi.eth` unless explicitly
whitelisted.

## How AGIJobManager verifies identity

AGIJobManager validates **agents** and **validators** via a layered model:

1) **Merkle allowlists**
   - `agentMerkleRoot` and `validatorMerkleRoot` allow proof‑based access.

2) **ENS namespace ownership**
   - The contract stores **root nodes** for the agent and club namespaces.
   - It derives a subnode from the supplied `subdomain` and checks ownership.
   - Ownership checks are satisfied if **either**:
     - `NameWrapper.ownerOf(subnode) == claimant`, **or**
     - the ENS resolver’s `addr(subnode)` returns the claimant address.

3) **Explicit allow/deny overrides**
   - `additionalAgents` / `additionalValidators` are explicit allowlist overrides.
   - `blacklistedAgents` / `blacklistedValidators` override everything else.

## Root nodes and namespace mapping

The contract stores four root nodes used for namespace checks:
- `clubRootNode` (base validator namespace)
- `agentRootNode` (base agent namespace)
- `alphaClubRootNode` (alpha validator namespace)
- `alphaAgentRootNode` (alpha agent namespace)

The agent/validator check accepts either base or `alpha` root nodes, so the
namespace grammar above is supported for both the base and `alpha` environments.

## Contract wiring references
- **ENS registry**: `ens` is used to resolve the resolver for a node.
- **NameWrapper**: `nameWrapper` is queried first for ownership of the subnode.
- **Roots**: `clubRootNode`/`alphaClubRootNode` for validators and `agentRootNode`/`alphaAgentRootNode` for agents.
- **Allowlist overrides**: `additionalAgents` and `additionalValidators` bypass Merkle/ENS checks, while `blacklistedAgents`/`blacklistedValidators` override everything else.

## Operational guidance

- **Merkle roots** can be rotated using `updateMerkleRoots` if an allowlist must
  be updated quickly.
- **Identity wiring** (token, ENS registry, NameWrapper, root nodes) should be
  treated as infrastructure and locked using `lockIdentityConfiguration()` once
  validated.
- **Lock timing**: lock after the first deployment and a successful validation
  of allowlists/ENS wiring, before broader production usage.
