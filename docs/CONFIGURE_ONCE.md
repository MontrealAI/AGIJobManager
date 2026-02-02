# Configure once, then operate with minimal governance

This guide is a practical, low‑touch runbook for deploying and operating AGIJobManager with minimal governance. It is intended to be used **once per deployment** (or per network) to capture immutable parameters, set one‑time configuration, and lock the contract into a steady‑state posture.

> **Scope**: This document complements the deployment flow in [`docs/Deployment.md`](Deployment.md). It does **not** change on‑chain behavior; it focuses on configuration, verification, and operational controls.

## Quick navigation
- [Roles & keys](#roles--keys)
- [Network addresses](#network-addresses)
- [One-time parameters](#one-time-parameters)
- [Emergency-only actions](#emergency-only-actions)
- [Rare governance actions](#rare-governance-actions)
- [Transaction order (configure once)](#transaction-order-configure-once)
- [Post-deploy verification checklist](#post-deploy-verification-checklist)
- [Operational scripts](#operational-scripts)
- [Known issues](#known-issues)

## Roles & keys

**Goal**: minimize day‑to‑day governance while preserving emergency recovery paths.

- **Owner**
  - **Recommended**: a multisig (e.g., Safe) with hardware‑secured signers.
  - **Fallback**: a hardware‑secured EOA if multisig is not available.
  - **Policy**: treat parameter changes as **exceptional** (require a runbook + human signoff).
- **Moderators**
  - **Recommended**: a *small* set (2–5) of trusted operators.
  - **Rotation**: pre‑define a rotation ceremony (e.g., rotate one address at a time, with a freeze period).
- **Validators/Agents**
  - **On‑chain allowlists** should reflect *off‑chain* trust policy decisions.
  - Prefer **Merkle‑gated lists** with proofs rather than frequent allowlist changes.

> **Minimal governance principle**: parameter changes should be **rare and explicit**. If a parameter needs frequent changes, it likely belongs in off‑chain policy rather than on‑chain governance.

## Network addresses

**Production token (fixed)**:
- `AGI_TOKEN_ADDRESS`: `0xA61a3B3a130a9c20768EEBF97E21515A6046a1fA`

Capture the following **per network** (e.g., mainnet, sepolia):

| Field | Description | Example / Notes |
| --- | --- | --- |
| `AGI_TOKEN_ADDRESS` | ERC‑20 token used for escrow | **Fixed production token** above |
| `ENS_ADDRESS` | ENS registry | Network‑specific |
| `NAME_WRAPPER_ADDRESS` | ENS NameWrapper | Network‑specific |
| `CLUB_ROOT_NODE` | ENS root node for validator gating | `bytes32` namehash |
| `AGENT_ROOT_NODE` | ENS root node for agent gating | `bytes32` namehash |
| `VALIDATOR_MERKLE_ROOT` | Merkle root for validator allowlist | `bytes32` |
| `AGENT_MERKLE_ROOT` | Merkle root for agent allowlist | `bytes32` |
| `AGIJOBMANAGER_ADDRESS` | Deployed AGIJobManager | Output of `truffle migrate` |

### Computing ENS root nodes
ENS root nodes are **namehashes**. For a name like `club.agi.eth`, compute the root node for the parent domain that is used in `_verifyOwnership`:

```bash
node -e "const { namehash } = require('@ensdomains/eth-ens-namehash'); console.log(namehash('agi.eth'))"
```

If you prefer not to add a dependency, use any ENS‑compatible namehash tooling and **record the exact name** that was hashed.

### Computing Merkle roots & proofs
Merkle roots should be derived from the **allowlist address set** used by off‑chain policy. The contract expects:
- `keccak256(address)` leaves
- **Sorted leaves** and **sorted pairs**

This repo provides a helper:

```bash
node scripts/merkle/generate_merkle_proof.js --input allowlist.json --address 0xYourAddress
```

The output includes:
- `root` → record this as `VALIDATOR_MERKLE_ROOT` / `AGENT_MERKLE_ROOT`
- `proof` → used by participants when calling allowlist‑gated functions

Keep the allowlist source file and root hash **archived** per network.

## One-time parameters

These should be set **once** at deployment or immediately after, and left unchanged unless a clear operational emergency arises.

**Core parameters (owner‑setters):**
- `requiredValidatorApprovals`
- `requiredValidatorDisapprovals`
- `validationRewardPercentage`
- `maxJobPayout`
- `jobDurationLimit`
- `completionReviewPeriod`
- `disputeReviewPeriod`
- `additionalAgentPayoutPercentage`
- `premiumReputationThreshold`
- `termsAndConditionsIpfsHash` (optional, for public policy references)
- `contactEmail` (optional, for incident response)
- `additionalText1/2/3` (optional metadata)

**Suggested defaults** (align with current contract defaults unless policy dictates otherwise):
- `requiredValidatorApprovals`: **3**
- `requiredValidatorDisapprovals`: **3**
- `validationRewardPercentage`: **8**
- `maxJobPayout`: **4888e18** (in token base units)
- `jobDurationLimit`: **10,000,000 seconds**
- `completionReviewPeriod`: **7 days**
- `disputeReviewPeriod`: **14 days**
- `additionalAgentPayoutPercentage`: **50**
- `premiumReputationThreshold`: **10,000**

> See [`docs/ParameterSafety.md`](ParameterSafety.md) for parameter safety rationale.

## Emergency-only actions

These are intended for **incident response** and should not be used in normal operations.

- `pause()` / `unpause()`
- `resolveStaleDispute()` (owner, when paused)
- `withdrawAGI()` surplus withdrawal (owner) — ensure locked escrow is respected

## Rare governance actions

These are expected to be **rare** changes:

- `addModerator` / `removeModerator`
- `addAdditionalValidator` / `removeAdditionalValidator`
- `addAdditionalAgent` / `removeAdditionalAgent`
- `blacklistAgent` / `blacklistValidator`
- `addAGIType` (adds NFT‑based payout tiers)

> When these change, update your off‑chain policy documentation and re‑run verification.

## Transaction order (configure once)

**Recommended sequence** (enforced in the post‑deploy script):
1. **Verify immutables**: token, ENS, NameWrapper, root nodes, Merkle roots.
2. **Set one‑time parameters** (thresholds, payout %, timeouts, max payout).
3. **Add AGI types** (if used).
4. **Set validation reward + additional agent payout** (after AGI types to respect payout caps).
5. **Add moderators / additional allowlists / blacklists**.
6. **Transfer ownership** to the long‑term multisig (last step).

## Post-deploy verification checklist

**Read‑only checks (anyone can run):**
- Confirm `owner`, `paused`, `agiToken`, `ens`, `nameWrapper`.
- Confirm `clubRootNode`, `agentRootNode`, `validatorMerkleRoot`, `agentMerkleRoot`.
- Confirm `requiredValidatorApprovals` / `requiredValidatorDisapprovals`.
- Confirm `validationRewardPercentage` + max AGI type payout ≤ 100.
- Confirm `additionalAgentPayoutPercentage` + `validationRewardPercentage` ≤ 100.
- Confirm `completionReviewPeriod` / `disputeReviewPeriod` within max limits.

**Invariants & sanity checks:**
- `requiredValidatorApprovals + requiredValidatorDisapprovals <= MAX_VALIDATORS_PER_JOB`.
- `validationRewardPercentage` in **1..100**.
- `maxJobPayout > 0` and `jobDurationLimit > 0`.

**Recommended smoke test (testnet):**
1. Create a job with a small payout.
2. Apply with an allowlisted agent.
3. Request completion with a valid URI.
4. Approve with validators to reach threshold.
5. Confirm payout + NFT mint.
6. Trigger a dispute and resolve via moderator (optional).

## Operational scripts

### 1) Post-deploy configuration

`truffle exec scripts/postdeploy-config.js --network <network> --address <AGIJOBMANAGER_ADDRESS>`

Supports:
- `--dry-run` to print the plan without sending transactions
- `--config <path>` to load a JSON config

Example `ops-config.json`:
```json
{
  "address": "0xYourContract",
  "expectedOwner": "0xDeployer",
  "newOwner": "0xMultisig",
  "agiTokenAddress": "0xA61a3B3a130a9c20768EEBF97E21515A6046a1fA",
  "ensAddress": "0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e",
  "nameWrapperAddress": "0x0000000000000000000000000000000000000000",
  "clubRootNode": "0x...",
  "agentRootNode": "0x...",
  "validatorMerkleRoot": "0x...",
  "agentMerkleRoot": "0x...",
  "requiredValidatorApprovals": 3,
  "requiredValidatorDisapprovals": 3,
  "validationRewardPercentage": 8,
  "maxJobPayout": "4888000000000000000000",
  "jobDurationLimit": "10000000",
  "completionReviewPeriod": "604800",
  "disputeReviewPeriod": "1209600",
  "additionalAgentPayoutPercentage": 50,
  "premiumReputationThreshold": "10000",
  "moderators": ["0x..."],
  "additionalValidators": ["0x..."],
  "additionalAgents": ["0x..."],
  "agiTypes": [{ "nftAddress": "0x...", "payoutPercentage": 50 }]
}
```

**Environment variables** (documented in `.env.example`):
- Addresses: `AGIJOBMANAGER_ADDRESS`, `AGI_TOKEN_ADDRESS`, `ENS_ADDRESS`, `NAME_WRAPPER_ADDRESS`
- Roots: `CLUB_ROOT_NODE`, `AGENT_ROOT_NODE`, `VALIDATOR_MERKLE_ROOT`, `AGENT_MERKLE_ROOT`
- Parameters: `REQUIRED_VALIDATOR_APPROVALS`, `REQUIRED_VALIDATOR_DISAPPROVALS`, `VALIDATION_REWARD_PERCENTAGE`, `MAX_JOB_PAYOUT`, `JOB_DURATION_LIMIT`, `COMPLETION_REVIEW_PERIOD`, `DISPUTE_REVIEW_PERIOD`, `ADDITIONAL_AGENT_PAYOUT_PERCENTAGE`, `PREMIUM_REPUTATION_THRESHOLD`
- Metadata: `TERMS_IPFS_HASH`, `CONTACT_EMAIL`, `ADDITIONAL_TEXT1/2/3`
- Lists: `MODERATORS`, `ADDITIONAL_VALIDATORS`, `ADDITIONAL_AGENTS`, `BLACKLISTED_AGENTS`, `BLACKLISTED_VALIDATORS`
- AGI types: `AGI_TYPES` (JSON array of `{ nftAddress, payoutPercentage }`)
- Ownership: `EXPECTED_OWNER`, `NEW_OWNER`

### 2) Read-only verification

`truffle exec scripts/verify-config.js --network <network> --address <AGIJOBMANAGER_ADDRESS>`

Outputs `PASS` / `FAIL` lines for CI‑friendly logs.

### 3) Bytecode size guard

`node scripts/check-bytecode-size.js`

Fails if `AGIJobManager` runtime bytecode exceeds the EIP‑170 limit (24,576 bytes). This is also wired into CI.

## Known issues

No known issues from the current local test run. If local tests fail or emit warnings in your environment, document them here with:
- failing test name(s)
- root cause
- minimal next step to resolve

(See `docs/TEST_STATUS.md` for baseline test status.)
