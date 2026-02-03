# Deployment checklist (configure once, then operate)

This checklist is for operators deploying AGIJobManager with minimal governance overhead. It assumes Truffle deployments and environment-driven configuration.

## 0) Pre-deploy decisions
- **Owner account / multisig**: choose a long-lived owner (recommended: multisig) that will perform initial configuration and lock the contract.
- **Moderators**: define the initial moderator set for dispute resolution.
- **Operational posture**: decide whether you will allow ongoing moderator/blacklist rotation after lock (supported for incident response).
- **Network addresses**:
  - ENS registry address
  - NameWrapper address
  - AGIALPHA token address (or a network-specific override for non-mainnet)

## 1) Canonical invariants (mainnet identity anchors)
These values are fixed identity anchors on Ethereum mainnet and should be treated as invariants.

### ENS validator roots (club role)
- `club.agi.eth` root node (bytes32): `0x39eb848f88bdfb0a6371096249dd451f56859dfe2cd3ddeab1e26d5bb68ede16`
- `alpha.club.agi.eth` root node (bytes32): `0x6487f659ec6f3fbd424b18b685728450d2559e4d68768393f9c689b2b6e5405e`

### ENS agent roots (agent role)
- `agent.agi.eth` root node (bytes32): `0x2c9c6189b2e92da4d0407e9deb38ff6870729ad063af7e8576cb7b7898c88e2d`
- `alpha.agent.agi.eth` root node (bytes32): `0xc74b6c5e8a0d97ed1fe28755da7d06a84593b4de92f6582327bc40f41d6c2d5e`

### Canonical token (Ethereum mainnet)
- AGIALPHA (18 decimals): `0xA61a3B3a130a9c20768EEBF97E21515A6046a1fA`

> **Deploy-time configurability:** ENS registry and NameWrapper addresses vary by chain and are set at deploy time. Non-mainnet deployments may (and usually should) override the token address.

## 2) Environment configuration
Copy `.env.example` to `.env` and set:
- `AGI_TOKEN_ADDRESS`
- `AGI_ENS_REGISTRY_ADDRESS`
- `AGI_NAMEWRAPPER_ADDRESS`
- `AGI_CLUB_ROOT_NODE`
- `AGI_ALPHA_CLUB_ROOT_NODE`
- `AGI_AGENT_ROOT_NODE`
- `AGI_ALPHA_AGENT_ROOT_NODE`
- `AGI_VALIDATOR_MERKLE_ROOT`
- `AGI_AGENT_MERKLE_ROOT`
- `AGI_BASE_IPFS_URL` (default is fine for mainnet)
- `LOCK_CONFIG=true` if you want migrations to auto-lock

**Mainnet defaults** are applied automatically when `network=mainnet`/chainId=1 unless overridden via env vars.

## 3) Deploy with Truffle
```bash
npx truffle migrate --network <network>
```

Migrations print a deployment summary with the token, ENS registry, NameWrapper, merkle roots, ENS root nodes, and whether configuration is locked.

## 4) Post-deploy configuration (optional but recommended)
Use `scripts/postdeploy-config.js` to apply initial settings. Keep the setup minimal and validate thresholds/percentages to avoid misconfiguration.

## 5) Post-deploy sanity checks
Perform a full flow on the target network:
1. Create a job.
2. Apply as an agent (via ENS ownership or Merkle allowlist).
3. Request completion.
4. Validate as a validator.
5. Finalize/complete the job and verify payouts + NFT issuance.

## 6) Lock configuration
Once initial setup is validated, **lock the configuration** to minimize governance:
- Call `lockConfiguration()` as the owner (or set `LOCK_CONFIG=true` during migration).

## 7) Break-glass runbook (after lock)
After lock:
- ✅ Pause/unpause remains available.
- ✅ Dispute recovery while paused (`resolveStaleDispute`) remains available.
- ✅ Moderator + blacklist rotation remains available for incident response.
- ❌ Economic knobs, allowlists, metadata, and payout configuration are frozen.

See [`docs/minimal-governance.md`](minimal-governance.md) for the full list of locked functions and recommended sequence.
