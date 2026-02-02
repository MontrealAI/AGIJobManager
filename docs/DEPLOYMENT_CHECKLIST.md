# Deployment checklist (configure once → minimal governance)

This checklist is for deployers who want to configure `AGIJobManager` once and then operate with minimal owner intervention. It focuses on **irreversible choices** and the smallest post‑deploy configuration surface.

## Pre‑deploy decisions (one‑time inputs)

**Addresses**
- **Owner address (recommended: multisig)** — determines who can pause, resolve stale disputes, and update operational parameters.
- **ENS registry + NameWrapper addresses** — chain‑specific; verify against ENS docs for your target network.

**Identity gating**
- **Validator Merkle root** (`validatorMerkleRoot`) — fixed at deployment.
- **Agent Merkle root** (`agentMerkleRoot`) — fixed at deployment.
- **ENS roots (fixed):**
  - `club.agi.eth` root node: `0x39eb848f88bdfb0a6371096249dd451f56859dfe2cd3ddeab1e26d5bb68ede16`
  - `agent.agi.eth` root node: `0x2c9c6189b2e92da4d0407e9deb38ff6870729ad063af7e8576cb7b7898c88e2d`

**Operational parameters**
> These are owner‑controlled **after deploy**, but should be set once (immediately after deployment) and then left alone.
- `requiredValidatorApprovals`, `requiredValidatorDisapprovals`
- `validationRewardPercentage`
- `maxJobPayout`, `jobDurationLimit`
- `completionReviewPeriod`, `disputeReviewPeriod`
- `premiumReputationThreshold`
- `additionalAgentPayoutPercentage` (legacy, no payout impact)
- `AGIType` payouts (NFT tiers used to determine agent payout)
- `baseIpfsUrl` (constructor only; no setter)

**Immutable invariants**
- **AGI token address** (18 decimals): `0xA61a3B3a130a9c20768EEBF97E21515A6046a1fA`
- ENS roots above (club + agent)

## Deployment steps

1. **Compile & size‑check**
   - Run `truffle compile` and the bytecode size gate before deployment.
2. **Deploy with constructor args**
   - `_agiTokenAddress` **must** be `0xA61a…`
   - `_clubRootNode` **must** be the `club.agi.eth` namehash above
   - `_agentRootNode` **must** be the `agent.agi.eth` namehash above
   - `_validatorMerkleRoot`, `_agentMerkleRoot` are your allowlists
   - `_ensAddress`, `_nameWrapperAddress` are chain‑specific ENS addresses
   - `_baseIpfsUrl` is the job NFT base URI (no setter exists post‑deploy)
3. **Verify the deployment**
   - Read `agiToken()`, `clubRootNode()`, `agentRootNode()` to confirm invariants.
   - Validate Merkle roots and ENS addresses match expected inputs.

## Immediate post‑deploy steps (configure once)

1. **Set moderators**
   - `addModerator(address)` for 1+ trusted dispute arbiters.
2. **Set validator thresholds**
   - `setRequiredValidatorApprovals`, `setRequiredValidatorDisapprovals`
3. **Set payout economics**
   - `setValidationRewardPercentage`
   - `addAGIType` for each payout tier (ensure `maxAgentPayout + validationRewardPercentage <= 100`)
4. **Set lifecycle controls**
   - `setMaxJobPayout`, `setJobDurationLimit`
   - `setCompletionReviewPeriod`, `setDisputeReviewPeriod`
5. **Set UI metadata (optional)**
   - `updateTermsAndConditionsIpfsHash`, `updateContactEmail`, `updateAdditionalText1/2/3`

## Ownership handoff / governance minimization

**Recommended**: transfer ownership to a multisig and keep it cold.  
**Optional**: renounce ownership if you accept losing the ability to:
- pause/unpause,
- add moderators or allowlists,
- resolve stale disputes,
- withdraw surplus escrow.

## Do‑not‑touch invariants

These are enforced in the constructor and are **not** changeable afterward:
- **AGI token address**: `0xA61a…`
- **ENS root nodes**: `club.agi.eth` + `agent.agi.eth`

The contract accepts **both** envless and `alpha.*` namespaces for ENS verification (see `docs/ENS_IDENTITY.md`).
