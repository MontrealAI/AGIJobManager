# Deployment checklist (configure once, operate with minimal governance)

This checklist is for mainnet deployers who want to **configure once**, then operate AGIJobManager with minimal owner intervention. It assumes Truffle deployments and the current on-chain invariants.

## Pre-deploy decisions (choose once)

**Identity & governance**
- Owner address (recommended: multisig; avoid hot EOAs).
- Moderator set (small, documented, 1–3 addresses).
- Whether to use Merkle allowlists vs. ENS-only for agents/validators.
- Emergency operators (who can pause/unpause and resolve stale disputes).

**Economic parameters (set-and-forget)**
- `requiredValidatorApprovals` / `requiredValidatorDisapprovals`
- `validationRewardPercentage`
- `maxJobPayout`
- `jobDurationLimit`
- `completionReviewPeriod`
- `disputeReviewPeriod`
- `premiumReputationThreshold`
- `additionalAgentPayoutPercentage` (legacy, not used in payout math)
- AGI type payout tiers (`addAGIType`)

## Deployment steps

1. **Verify constructor invariants**
   - AGI token address is fixed: `0xA61a3B3a130a9c20768EEBF97E21515A6046a1fA`.
   - ENS root nodes are fixed to:
     - `club.agi.eth`: `0x39eb848f88bdfb0a6371096249dd451f56859dfe2cd3ddeab1e26d5bb68ede16`
     - `agent.agi.eth`: `0x2c9c6189b2e92da4d0407e9deb38ff6870729ad063af7e8576cb7b7898c88e2d`

2. **Deploy**
   - Constructor args (in order):
     1. `AGI token address` (must match above)
     2. `baseIpfsUrl`
     3. `ENS registry address`
     4. `NameWrapper address`
     5. `clubRootNode` (envless root)
     6. `agentRootNode` (envless root)
     7. `validatorMerkleRoot`
     8. `agentMerkleRoot`

3. **Verify deployment**
   - Confirm `agiToken()`, `clubRootNode()`, `agentRootNode()` match invariants.
   - Confirm `ens()` and `nameWrapper()` are correct for the network.

## Immediate post-deploy steps (configure once)

1. **Optional: pause while configuring**
   - `pause()` → apply configuration → `unpause()`.

2. **Set parameters (single configuration run)**
   - Use `scripts/postdeploy-config.js` to apply the chosen parameter set.
   - Validate with `scripts/verify-config.js` and `scripts/ops/validate-params.js`.

3. **Seed allowlists**
   - `addModerator`, `addAdditionalAgent`, `addAdditionalValidator` (only if needed).

## Ownership handoff / governance minimization

- **Recommended:** transfer ownership to a multisig immediately after configuration.
- **Optional:** renounce ownership only if you accept the loss of:
  - `pause/unpause`, `resolveStaleDispute`, `withdrawAGI`
  - allowlist updates and blacklist controls
  - parameter adjustments (validator thresholds, review windows, payout caps)

## Do-not-touch invariants (enforced on-chain)

- **Token**: `agiToken` is fixed to `0xA61a3B3a130a9c20768EEBF97E21515A6046a1fA`.
- **ENS roots**:
  - Validators must be under `club.agi.eth` **or** `alpha.club.agi.eth`.
  - Agents must be under `agent.agi.eth` **or** `alpha.agent.agi.eth`.
- These invariants are **checked in the constructor** and cannot be changed after deployment.
