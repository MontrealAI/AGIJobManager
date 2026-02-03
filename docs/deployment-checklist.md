# Deployment checklist (configure once → minimal governance)

This checklist is for operators who want to deploy, configure once, and then operate the system with minimal ongoing governance. It covers network-specific setup, canonical mainnet invariants, deployment, sanity checks, and when to lock configuration.

## 1) Pre-deploy decisions

- **Owner account**: use a multisig (recommended) and decide the signer policy.
- **Moderators**: pick initial moderators (dispute resolvers) and document who can rotate them.
- **Operational posture**: decide which parameters you must set at deploy time versus post-deploy configuration.
- **Allowlists/Merkle**: confirm which agent/validator allowlists you will use (Merkle roots or explicit allowlists).

## 2) Network-specific addresses (deploy-time inputs)

These inputs vary by chain and must be provided at deploy time. Set them via environment variables before running migrations.

- `AGI_TOKEN_ADDRESS`: ERC-20 token used for payouts/escrow.
- `AGI_ENS_REGISTRY`: ENS registry address for the target network.
- `AGI_NAME_WRAPPER`: ENS NameWrapper address for the target network.
- `AGI_BASE_IPFS_URL`: base IPFS URL (default `https://ipfs.io/ipfs/`).
- `AGI_CLUB_ROOT_NODE`: ENS namehash for `club.agi.eth` (validators).
- `AGI_ALPHA_CLUB_ROOT_NODE`: ENS namehash for `alpha.club.agi.eth` (validators).
- `AGI_AGENT_ROOT_NODE`: ENS namehash for `agent.agi.eth` (agents).
- `AGI_ALPHA_AGENT_ROOT_NODE`: ENS namehash for `alpha.agent.agi.eth` (agents).
- `AGI_VALIDATOR_MERKLE_ROOT`: Merkle root for validator allowlist.
- `AGI_AGENT_MERKLE_ROOT`: Merkle root for agent allowlist.
- `LOCK_CONFIG` (optional): `true` to auto-lock configuration at the end of migration.

## 3) Canonical mainnet invariants

These are fixed identity anchors on Ethereum mainnet (documented invariants):

- **AGIALPHA token (mainnet, 18 decimals)**: `0xA61a3B3a130a9c20768EEBF97E21515A6046a1fA`
- **Validator roots**
  - `club.agi.eth` root node: `0x39eb848f88bdfb0a6371096249dd451f56859dfe2cd3ddeab1e26d5bb68ede16`
  - `alpha.club.agi.eth` root node: `0x6487f659ec6f3fbd424b18b685728450d2559e4d68768393f9c689b2b6e5405e`
- **Agent roots**
  - `agent.agi.eth` root node: `0x2c9c6189b2e92da4d0407e9deb38ff6870729ad063af7e8576cb7b7898c88e2d`
  - `alpha.agent.agi.eth` root node: `0xc74b6c5e8a0d97ed1fe28755da7d06a84593b4de92f6582327bc40f41d6c2d5e`

> These values are invariants for mainnet identity. The contract still allows deploy-time configurability for ENS registry and NameWrapper addresses on Sepolia/local/private networks.

## 4) Compile settings (deterministic + bytecode-safe)

- Solidity compiler: **0.8.26**
- Optimizer: **enabled**, `runs = 500`
- `viaIR`: **false**

Rationale: `runs = 500` is a standard optimization level that avoids extreme settings and keeps bytecode under EIP-170 limits without relying on `viaIR`.

## 5) Deployment steps

1. **Install deps**
   ```bash
   npm install
   ```
2. **Compile**
   ```bash
   npm run build
   ```
3. **Migrate** (example for Sepolia)
   ```bash
   npx truffle migrate --network sepolia
   ```

The migration prints a summary with the token, ENS/NameWrapper addresses, Merkle roots, and root nodes used.

## 6) Post-deploy configuration (optional)

Use the post-deploy config script if you need to tune parameters after deployment:

```bash
node scripts/postdeploy-config.js --network <network> --address <AGIJobManager>
```

This script reads `AGI_*` config values from `.env` and applies them in a safe order.

## 7) Post-deploy sanity checks

Recommended quick check (in order):

1. **Create job** (employer funds escrow).
2. **Apply for job** (agent passes allowlist/Merkle/ENS checks).
3. **Request completion** (agent posts completion URI).
4. **Validate** (validators approve or disapprove).
5. **Finalize** (job completes, payouts + NFT minted).

Confirm escrow balance updates and token balances for employer/agent/validators.

## 8) Lock configuration (one-way)

Once configuration is correct, call:

```bash
# in Truffle console
await manager.lockConfiguration();
```

Or set `LOCK_CONFIG=true` before `truffle migrate` to auto-lock after deployment.

Locking configuration is irreversible and is intended to reduce governance surface.

## 9) Break-glass runbook (after lock)

After lock, the following remain available for safety and recovery:

- **Pause/unpause** the contract.
- **Resolve stale disputes** while paused via `resolveStaleDispute`.
- **Moderator rotation** and **blacklist updates** for security incidents.

All economic/configuration setters are disabled once the lock is active.
