# Deployment checklist (configure once → operate with minimal governance)

This checklist is a practical, operator-facing guide for deploying **AGIJobManager** with a “configure once, then operate” posture. It assumes Truffle deployments and the environment variables used by `migrations/2_deploy_contracts.js`.

## 1) Pre-deploy decisions

- **Owner account**: choose a multisig or hardened operator address. This account controls configuration and can lock it permanently.
- **Moderator set**: decide who can resolve disputes (ideally a separate multisig or a small quorum).
- **Operational posture**: decide whether you will:
  - allow any post-lock changes (recommended: only pause/unpause + incident response),
  - use blacklists for abuse mitigation before configuration is locked,
  - rotate moderators (optional break-glass).

## 2) Network-specific addresses

Provide these addresses via environment variables (see `.env.example`):

| Purpose | Env var | Notes |
| --- | --- | --- |
| AGI token | `AGI_TOKEN_ADDRESS` | Mainnet defaults to the canonical token only when deploying to chain id 1. |
| ENS registry | `AGI_ENS_REGISTRY` | Chain-specific. |
| ENS NameWrapper | `AGI_NAMEWRAPPER` | Chain-specific. |
| Base IPFS URL | `AGI_BASE_IPFS_URL` | Defaults to `https://ipfs.io/ipfs/`. |
| Club root node | `AGI_CLUB_ROOT_NODE` | Base namespace root (validators). |
| Alpha club root node | `AGI_ALPHA_CLUB_ROOT_NODE` | Alpha namespace root (validators). |
| Agent root node | `AGI_AGENT_ROOT_NODE` | Base namespace root (agents). |
| Alpha agent root node | `AGI_ALPHA_AGENT_ROOT_NODE` | Alpha namespace root (agents). |
| Validator Merkle root | `AGI_VALIDATOR_MERKLE_ROOT` | Allowlist root for validators. |
| Agent Merkle root | `AGI_AGENT_MERKLE_ROOT` | Allowlist root for agents. |
| Optional auto-lock | `LOCK_CONFIG=true` | Locks configuration at the end of migration. |

### Invariants + defaults (mainnet)

These values are fixed **identity anchors** on Ethereum mainnet (documented invariants):

**Token (18 decimals)**
- AGIALPHA mainnet token: `0xA61a3B3a130a9c20768EEBF97E21515A6046a1fA`

**Validator roots (club role)**
- `club.agi.eth`: `0x39eb848f88bdfb0a6371096249dd451f56859dfe2cd3ddeab1e26d5bb68ede16`
- `alpha.club.agi.eth`: `0x6487f659ec6f3fbd424b18b685728450d2559e4d68768393f9c689b2b6e5405e`

**Agent roots (agent role)**
- `agent.agi.eth`: `0x2c9c6189b2e92da4d0407e9deb38ff6870729ad063af7e8576cb7b7898c88e2d`
- `alpha.agent.agi.eth`: `0xc74b6c5e8a0d97ed1fe28755da7d06a84593b4de92f6582327bc40f41d6c2d5e`

> **Notes:**  
> - ENS registry and NameWrapper addresses are chain-specific and must remain configurable for Sepolia/local/private networks.  
> - Namehash outputs are deterministic across chains; only the registry/NameWrapper addresses vary by network.

## 3) Step-by-step deployment

1. **Install deps**
   ```bash
   npm install
   ```
2. **Set env vars** (copy `.env.example` → `.env`).
3. **Compile**
   ```bash
   npm run build
   ```
4. **Deploy** (Truffle)
   ```bash
   npx truffle migrate --network <network>
   ```

The migration prints a summary of the token, ENS registry, NameWrapper, Merkle roots, root nodes, and lock status.

### Optional: configure after deploy

Use the post-deploy configuration script to set thresholds, payouts, moderators, and optional lists:

```bash
truffle exec scripts/postdeploy-config.js --network <network>
```

## 4) Post-deploy sanity checks

Perform at least one lifecycle test on the deployed contract:

1. **Create job** (employer funds escrow).
2. **Apply** (agent with allowlist or ENS subname).
3. **Request completion** (agent supplies completion metadata URI).
4. **Validate** (validator approves; ensure threshold is met).
5. **Finalize** (ensure payout, reputation update, and NFT issuance).

If using ENS gating, test **both namespaces**:
- `agent.agi.eth` **and** `alpha.agent.agi.eth`
- `club.agi.eth` **and** `alpha.club.agi.eth`

Merkle roots are **allowlists only**. They grant access to apply/validate but do **not** change payouts. Agent payout remains determined by AGIType NFT ownership (`getHighestPayoutPercentage`).

## 5) Lock configuration (one-way)

After setup and validation, lock configuration to minimize governance:

- **Preferred**: set `LOCK_CONFIG=true` before migration to auto-lock.
- **Manual**: call `lockConfiguration()` from the owner account.

Once locked, **critical configuration setters** are disabled permanently (see `docs/minimal-governance.md`).
Critical wiring includes the AGI token address, ENS registry, NameWrapper, and ENS root nodes; each is only mutable pre‑first‑job and pre‑lock.

## 6) Break-glass runbook (after lock)

After lock, operators should only use:
- `pause()` / `unpause()` for incident response.
- `resolveStaleDispute()` (owner + paused, after timeout) for dispute recovery.
- Optional moderator rotation if required.
- Surplus withdrawals (`withdrawAGI`) while paused; escrowed funds remain reserved (`lockedEscrow`).

> **Escrow safety:** withdrawals can never touch escrowed job funds because `withdrawableAGI = balance - lockedEscrow` and the call reverts if the escrow balance is insolvent.

Everything else remains operable but should be governed by your ops policy to keep the surface minimal.

## 7) Verification (Etherscan)

**Normal path (viaIR disabled)**:
1. Compile with the pinned compiler settings (solc `0.8.19`, runs `50`).
2. Verify using `truffle-plugin-verify` with the same compiler settings and constructor args.

**Fallback (Standard JSON input)**:
1. Compile with the same optimizer/metadata settings.
2. In Etherscan, select **Solidity (Standard-Json-Input)** and paste the JSON from the build step.
3. Ensure the JSON includes `viaIR: false`, `optimizer.runs: 50`, `metadata.bytecodeHash: "none"`, and the exact constructor args.

> To reproduce Standard JSON input deterministically, keep compiler settings pinned in `truffle-config.js` and rebuild before verification.
