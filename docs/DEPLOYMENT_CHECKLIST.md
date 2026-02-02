# Deployment Checklist — Configure Once, Operate with Minimal Governance

This checklist is a **mainnet-ready** runbook for deploying AGIJobManager, setting initial parameters, and minimizing governance touchpoints after launch.

## 1) Pre-deploy decisions (record before deployment)

**Ownership & governance**
- ✅ **Owner address** (recommended: multisig/timelock).
- ✅ **Moderator addresses** (1–3 trusted arbiters).
- ✅ **Allowlist policy**: ENS-only, Merkle-only, or hybrid.
- ✅ **Emergency posture**: when to pause/unpause; who can authorize.

**Operational parameters (set-and-forget)**
- `requiredValidatorApprovals` / `requiredValidatorDisapprovals`
- `validationRewardPercentage`
- `maxJobPayout`
- `jobDurationLimit`
- `completionReviewPeriod`
- `disputeReviewPeriod`
- `premiumReputationThreshold`
- `additionalAgentPayoutPercentage` (legacy value; not used in payout math)
- `AGI types` (NFT payout tiers)
- `baseIpfsUrl`

**Allowlist data**
- Merkle allowlists for agents/validators (leaf = `keccak256(address)`).
- ENS policy: ensure `club.agi.eth` and `agent.agi.eth` subdomains are configured.

## 2) Deployment steps (constructor + verification)

**Constructor arguments (all immutable)**
1. `agiToken` — **must** be `0xA61a3B3a130a9c20768EEBF97E21515A6046a1fA`.
2. `baseIpfsUrl`
3. `ens` registry address
4. `nameWrapper` address
5. `clubRootNode` — **must** be `namehash("club.agi.eth")`
6. `agentRootNode` — **must** be `namehash("agent.agi.eth")`
7. `validatorMerkleRoot`
8. `agentMerkleRoot`

**Verify after deploy**
- `agiToken()` returns the canonical token address.
- `clubRootNode()` / `agentRootNode()` return the canonical roots.
- `ens()` / `nameWrapper()` are correct for the network.
- `validatorMerkleRoot()` / `agentMerkleRoot()` match your allowlists.
- Bytecode size is within 24,576 bytes for deployable contracts:
  ```bash
  npm run build
  node scripts/check-bytecode-size.js
  ```

## 3) Immediate post-deploy steps (single pass)

1. **Pause (optional)** if you plan to set parameters before opening usage.
2. **Apply initial configuration** (owner-only):
   - thresholds, reward %, job caps, review periods
   - metadata fields (terms/contact)
   - AGI type payout tiers
3. **Set moderators** and any **additional allowlists** (if needed).
4. **Unpause** once configuration is verified.

## 4) Ownership handoff (governance minimization)

**Recommended**: transfer ownership to a multisig/timelock:
- `transferOwnership(<multisig>)`
- After handoff, updates require multisig confirmation.

**Optional**: `renounceOwnership()` for maximal minimization.
- **Consequence**: no more owner-only actions (pause, disputes, config changes, withdrawals).
- Only use if you are confident the system can run without any owner intervention.

## 5) “Do not touch” invariants

These invariants are enforced on-chain and should never be changed:

1. **AGI token address** (fixed forever)
   - `agiToken` is **locked** to `0xA61a…` in the constructor.
2. **ENS root nodes** (fixed forever)
   - `clubRootNode = namehash("club.agi.eth")`
   - `agentRootNode = namehash("agent.agi.eth")`
   - The contract **derives** and accepts `alpha.club.agi.eth` and `alpha.agent.agi.eth` automatically.

If any of these values are wrong at deployment time, **redeploy**.
