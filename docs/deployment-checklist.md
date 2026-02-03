# Deployment Checklist (Configure Once, Operate with Minimal Governance)

This checklist is for operators who want to **configure once**, run a short validation cycle, then **lock configuration** so the system can operate with minimal ongoing governance.

## 1) Pre-deploy decisions

- **Owner account**: use a multisig or hardware-secured EOA. This key controls `lockConfiguration()` and emergency operations.
- **Moderators**: choose a small, trusted set (1–3). Moderators resolve disputes via `resolveDisputeWithCode()`.
- **Operational posture**: decide whether you will **auto‑lock** configuration at deployment (`AGI_LOCK_CONFIG=true`) or lock manually after validation.
- **Allowlists**: decide validator/agent allowlists and Merkle roots for your network.
- **ENS namespaces**: confirm you will accept both **base** and **alpha** namespaces for each role (agent/validator).

## 2) Network-specific addresses

These values vary by chain and must be configured at deploy time:

- **Token** (`AGI_TOKEN_ADDRESS`)
- **ENS registry** (`AGI_ENS_ADDRESS`)
- **ENS NameWrapper** (`AGI_NAME_WRAPPER_ADDRESS`)
- **ENS root nodes** (base + alpha for each role):
  - `AGI_CLUB_ROOT_NODE` (club.agi.eth)
  - `AGI_ALPHA_CLUB_ROOT_NODE` (alpha.club.agi.eth)
  - `AGI_AGENT_ROOT_NODE` (agent.agi.eth)
  - `AGI_ALPHA_AGENT_ROOT_NODE` (alpha.agent.agi.eth)
- **Merkle roots** (required):
  - `AGI_VALIDATOR_MERKLE_ROOT`
  - `AGI_AGENT_MERKLE_ROOT`

### Canonical mainnet invariants

These are fixed identity anchors on Ethereum mainnet:

**Token (18 decimals)**
- `AGI_TOKEN_ADDRESS`: `0xA61a3B3a130a9c20768EEBF97E21515A6046a1fA`

**Validator roots (club role)**
- `club.agi.eth` root node: `0x39eb848f88bdfb0a6371096249dd451f56859dfe2cd3ddeab1e26d5bb68ede16`
- `alpha.club.agi.eth` root node: `0x6487f659ec6f3fbd424b18b685728450d2559e4d68768393f9c689b2b6e5405e`

**Agent roots (agent role)**
- `agent.agi.eth` root node: `0x2c9c6189b2e92da4d0407e9deb38ff6870729ad063af7e8576cb7b7898c88e2d`
- `alpha.agent.agi.eth` root node: `0xc74b6c5e8a0d97ed1fe28755da7d06a84593b4de92f6582327bc40f41d6c2d5e`

> **Important**: mainnet defaults are invariant identity anchors. For Sepolia/local/private deployments, override these via environment variables.

## 3) Deployment (Truffle)

Set environment variables (see `.env.example`), then run:

```bash
truffle migrate --network <network>
```

**Compiler defaults**: optimizer is enabled with **200 runs** (balanced deployment/runtime trade‑off and smaller bytecode) and `viaIR` is **enabled** to avoid stack‑too‑deep errors in the non‑IR pipeline. Override only if you have a strong reason.
**Optional auto‑lock**: set `AGI_LOCK_CONFIG=true` before migrating to lock immediately after deployment.

The migration prints a summary including: token, ENS, NameWrapper, root nodes, Merkle roots, and whether configuration is locked.
The migration also calls `setAlphaRootNodes()` with `AGI_ALPHA_CLUB_ROOT_NODE` and `AGI_ALPHA_AGENT_ROOT_NODE`.

## 4) Post-deploy configuration

Use the existing config scripts to set one‑time parameters:

```bash
AGI_CONFIG_PATH=/path/to/config.json \
truffle exec scripts/postdeploy-config.js --network <network> --address <AGIJobManagerAddress>
```

Recommended: **perform configuration before locking**. Once locked, configuration-changing admin functions are disabled.

## 5) Post-deploy sanity checks (smoke tests)

Perform a short operational cycle:

1. **Create a job** with a small payout and short duration.
2. **Apply** as an agent (Merkle allowlist or ENS ownership).
3. **Request completion** with a valid URI.
4. **Validate** as a validator (Merkle allowlist or ENS ownership).
5. **Finalize** and confirm:
   - escrow was released
   - agent/validator payouts are correct
   - job NFT minted with completion URI

## 6) Lock configuration (irreversible)

After configuration + sanity checks:

```bash
truffle exec -e "const m=await AGIJobManager.at('<address>'); await m.lockConfiguration();"
```

Or re‑deploy with `AGI_LOCK_CONFIG=true`.

## 7) Break‑glass runbook (after lock)

The following **remain available** after lock and should be used only for incident response:

- `pause()` / `unpause()`
- `resolveStaleDispute()` (owner, paused)
- `resolveDisputeWithCode()` (moderators)
- `blacklistAgent()` / `blacklistValidator()`
- `addModerator()` / `removeModerator()`

For full details, see **[docs/minimal-governance.md](minimal-governance.md)**.
