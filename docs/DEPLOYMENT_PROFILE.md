# Deployment profile: configure once, operate with minimal governance

This profile gives a **step‑by‑step** workflow to deploy AGIJobManager, run a single post‑deploy configuration, transfer ownership to a long‑term minimal‑governance owner, and operate day‑to‑day with minimal governance actions.

> This profile complements the general Truffle deployment guide in [`docs/Deployment.md`](Deployment.md).

---

## Preconditions (capture before deployment)

**Required constructor parameters** (immutable after deploy):
- `agiToken` (ERC‑20 escrow token)
- `baseIpfsUrl`
- `ens` registry
- `nameWrapper`
- `clubRootNode` (validator namespace)
- `agentRootNode` (agent namespace)
- `validatorMerkleRoot`
- `agentMerkleRoot`

**Mainnet token invariant (non‑negotiable)**
- **AGIALPHA ERC‑20**: `0xA61a3B3a130a9c20768EEBF97E21515A6046a1fA` (18 decimals)
- This token address **does not change** on Ethereum mainnet.

**ENS identity schema (canonical)**
- **Validators**: `*.alpha.club.agi.eth` | `*.club.agi.eth`
- **Agents**: `*.alpha.agent.agi.eth` | `*.agent.agi.eth`
- **Nodes**: `*.alpha.node.agi.eth` | `*.node.agi.eth`
- **Sovereigns**: `*.alpha.agi.eth` | `*.agi.eth`

**Allowlists & roots**
- Confirm Merkle roots for validators/agents (sorted‑pairs Merkle tree, leaf = `keccak256(address)`).
- Compute ENS root nodes (namehash for `club.agi.eth`, `alpha.club.agi.eth`, `agent.agi.eth`, `alpha.agent.agi.eth`).

**Bytecode size guardrail**
- Compile and check runtime sizes before deployment:
  ```bash
  npx truffle compile --all
  node scripts/check-bytecode-size.js
  ```

---

## Deployment checklist (configure once)

1. **Deploy while paused** (recommended) or pause immediately post‑deploy.
2. **Run post‑deploy configuration** (single run):
   ```bash
   AGI_CONFIG_PATH=/path/to/config.json \
   truffle exec scripts/postdeploy-config.js --network <network> --address <AGIJobManagerAddress>
   ```
3. **Verify configuration** (read‑only):
   ```bash
   AGI_CONFIG_PATH=/path/to/config.json \
   truffle exec scripts/verify-config.js --network <network> --address <AGIJobManagerAddress>
   ```
4. **Unpause** the contract.
5. **Transfer ownership** to a long‑term minimal‑governance owner (multisig/timelock).
   - This can be done inside `postdeploy-config.js` via `transferOwnershipTo`.

---

## “Set and mostly forget” parameter table

These values should be set once in the post‑deploy configuration and treated as **exception‑only** thereafter.

| Parameter | Purpose | Recommended posture |
| --- | --- | --- |
| `requiredValidatorApprovals` | Validator approvals needed for completion. | Set once pre‑launch; avoid changing post‑launch. |
| `requiredValidatorDisapprovals` | Validator disapprovals needed to trigger dispute. | Set once pre‑launch; avoid changing post‑launch. |
| `premiumReputationThreshold` | Reputation gating for premium access. | Set once; adjust only if policy changes. |
| `validationRewardPercentage` | % of payout reserved for validators. | Set once; ensure `maxAgentPayout + validationReward ≤ 100`. |
| `maxJobPayout` | Maximum allowed job escrow. | Set once; adjust only with risk review. |
| `jobDurationLimit` | Maximum job duration. | Set once; avoid changing. |
| `completionReviewPeriod` | Timeout for finalize without validator action. | Set once; avoid changing. |
| `disputeReviewPeriod` | Timeout for stale dispute resolution. | Set once; avoid changing. |
| `additionalAgentPayoutPercentage` | Stored config (not used in payout calc). | Set once; update only if policy changes. |
| `termsAndConditionsIpfsHash` | Terms URI. | Set once; update only with published notice. |
| `contactEmail` / `additionalText1‑3` | Operator metadata. | Set once; update only when contact details change. |
| `agiTypes[]` | Agent payout tiers by NFT. | Add once pre‑launch; update rarely and with review. |

---

## Minimal governance operations (day‑to‑day)

- **Normal operations** require no owner action.
- **Incident actions**: `pause`, `resolveStaleDispute` (paused), `withdrawAGI` (paused).
- **Rare actions**: adjust allowlists, add/remove moderators, update AGI types.

For governance posture and emergency policy, see [`docs/GOVERNANCE.md`](GOVERNANCE.md).

---

## Trust model summary (canonical narrative)

AGI Jobs is framed as **identity → proof → settlement → governance**. Work is measured in **α‑Work Units (α‑WU)** derived from signed telemetry and quality scoring; $AGIALPHA is the utility token that stakes, settles, and coordinates. Operators are expected to run **fail‑closed** controls, keep pre‑alpha deployments policy‑bounded, and scale autonomy only as verification stays ahead. For the full narrative, see [`docs/AGI_JOBS_ONE_PAGER.md`](AGI_JOBS_ONE_PAGER.md).
