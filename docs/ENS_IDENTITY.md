# ENS Identity — Dual Namespace Support

AGIJobManager recognizes **both** envless and alpha namespaces for agent and validator identities.

## Accepted namespaces

**Agents**
- `*.agent.agi.eth`
- `*.alpha.agent.agi.eth`

**Validators (club)**
- `*.club.agi.eth`
- `*.alpha.club.agi.eth`

Only the **left-most label** is passed into the contract (`subdomain`). Example:
- `helper.agent.agi.eth` → `subdomain = "helper"`
- `helper.alpha.agent.agi.eth` → `subdomain = "helper"`

## Verification flow (on-chain order)

When an agent or validator calls a gated function, the contract checks:

1. **Merkle allowlist** (`agentMerkleRoot` / `validatorMerkleRoot`)
2. **NameWrapper ownership** (`ownerOf(uint256(node))`)
3. **ENS resolver address** (`resolver(node)` → `addr(node)`)

The contract attempts these checks for the **envless root** first, then repeats them for the derived **alpha** root.

## Operational expectations

- ENS ownership should be configured in **NameWrapper** or via **resolver records**.
- If ENS checks fail, monitor `RecoveryInitiated(reason)` events to diagnose:
  - `NO_RES` → no resolver set
  - `RES_FAIL` → resolver call failed
  - `NW_FAIL` → NameWrapper call failed
- Merkle allowlists are optional but can be used for private rollouts.
- `additionalAgents` / `additionalValidators` are emergency bypasses only.
