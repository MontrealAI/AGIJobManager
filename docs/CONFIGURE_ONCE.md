# Configure Once, Operate with Minimal Governance

This guide defines a **configure-once, set-and-forget** operational posture for AGIJobManager. The intent is to set stable parameters at deploy time (or immediately after), then minimize governance touchpoints to emergency-only actions. The contract supports this posture via a **one-way configuration lock** (`lockConfiguration()`), aligned with the existing Truffle workflow.

## Scope

- **Configuration lock available**: once locked, admin configuration changes are disabled.
- **Truffle-first**: uses `truffle exec` scripts.
- **No secrets in-repo**: use `.env` locally and keep it uncommitted.

## Roles & Keys (minimal governance)

- **Owner**: Use a multisig wallet (recommended) or hardware-secured EOAs. Treat owner actions as exceptional and documented.
- **Moderators**: Keep the moderator set small (e.g., 1–3) and rotate through explicit, logged runbooks.
- **Validators/Agents allowlists**: Prefer Merkle roots and ENS ownership checks. Use `additionalAgents`/`additionalValidators` only for exceptional or recovery cases.

**Governance posture**:
- Parameter changes are **exceptional**. Require a written runbook + signoff.
- Keep a changelog of each owner-level action (hash, signer set, reason).

## One-time parameters (configure once)

### A) Constructor-time (immutable)
These are fixed at deployment and **cannot be changed** without redeploying.

- `agiToken` (ERC-20 used for escrow)
- `baseIpfsUrl`
- `ens` + `nameWrapper`
- `clubRootNode` + `agentRootNode`
- `validatorMerkleRoot` + `agentMerkleRoot`

### B) Post-deploy but intended to remain stable
Set these once via `scripts/postdeploy-config.js`, then lock configuration and treat changes as exceptional.

- `requiredValidatorApprovals`
- `requiredValidatorDisapprovals`
- `setAlphaRootNodes` (alpha roots for club/agent namespaces)
- `premiumReputationThreshold`
- `validationRewardPercentage`
- `maxJobPayout`
- `jobDurationLimit`
- `completionReviewPeriod`
- `disputeReviewPeriod`
- `additionalAgentPayoutPercentage`
- `termsAndConditionsIpfsHash`
- `contactEmail`, `additionalText1-3`
- **AGI Types** (payout tiers)

## Emergency-only actions

These should be used only for incident response, then returned to normal operation.

- `pause()` / `unpause()` (owner)
- `resolveStaleDispute()` (owner + paused)
- `resolveDisputeWithCode()` (moderator)

### Configuration lock (one-way)
After initial setup and validation, call `lockConfiguration()` to permanently disable configuration-changing admin functions.

## Rare governance actions

Use only when needed, with a runbook + signoff:

- Add/remove moderators
- Add/remove additional validators/agents (disabled after lock)
- Blacklist/unblacklist agents/validators
- Add/update AGI types (payout tiers; disabled after lock)

## Network addresses

### Production token (fixed)
The intended production token address is:

- **AGI token**: `0xA61a3B3a130a9c20768EEBF97E21515A6046a1fA`

### ENS + NameWrapper + root nodes + Merkle roots
Record these per network **before deploy**, and keep them immutable afterward.

| Network | ENS | NameWrapper | clubRootNode | alphaClubRootNode | agentRootNode | alphaAgentRootNode | validatorMerkleRoot | agentMerkleRoot |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| mainnet | _fill_ | _fill_ | _fill_ | _fill_ | _fill_ | _fill_ | _fill_ | _fill_ |
| sepolia | _fill_ | _fill_ | _fill_ | _fill_ | _fill_ | _fill_ | _fill_ | _fill_ |
| other | _fill_ | _fill_ | _fill_ | _fill_ | _fill_ | _fill_ | _fill_ | _fill_ |

**Computing root nodes**:
- `clubRootNode`/`agentRootNode` and `clubRootNodeAlpha`/`agentRootNodeAlpha` are **ENS namehashes** for the root namespaces you want to use (e.g., `club.agi.eth`, `alpha.club.agi.eth`, `agent.agi.eth`, `alpha.agent.agi.eth`).
- Use `ethers.utils.namehash("<root-name>")` (or any ENS namehash implementation) and record the hex value per network.

**Computing Merkle roots**:
- Leaves are `keccak256(address)` (address bytes, lowercased). The Merkle tree uses **sorted pairs + sorted leaves**.
- Use the existing helper:
  ```bash
  node scripts/merkle/generate_merkle_proof.js --input addresses.json --address 0xYourAddress
  ```
  The output includes the Merkle root and proof for that address.
- Maintain a canonical allowlist file per network (e.g., `allowlists/validators-mainnet.json`) and regenerate roots when the list changes.

## Post-deploy configuration (scripted)

### 1) Configuration file (recommended)
Create a JSON config (kept local) and run (use `AGI_CONFIG_PATH` or `--config-path` to avoid Truffle’s own `--config` flag):

```bash
AGI_CONFIG_PATH=/path/to/config.json \
truffle exec scripts/postdeploy-config.js --network <network> --address <AGIJobManagerAddress>
```

Or:

```bash
truffle exec scripts/postdeploy-config.js --network <network> --address <AGIJobManagerAddress> --config-path /path/to/config.json
```

**Config JSON structure** (example):

```json
{
  "requiredValidatorApprovals": 3,
  "requiredValidatorDisapprovals": 3,
  "premiumReputationThreshold": 10000,
  "validationRewardPercentage": 8,
  "maxJobPayout": "4888000000000000000000",
  "jobDurationLimit": 10000000,
  "completionReviewPeriod": 604800,
  "disputeReviewPeriod": 1209600,
  "additionalAgentPayoutPercentage": 50,
  "termsAndConditionsIpfsHash": "ipfs://...",
  "contactEmail": "ops@example.com",
  "additionalText1": "...",
  "additionalText2": "...",
  "additionalText3": "...",
  "agiTypes": [
    { "nftAddress": "0x...", "payoutPercentage": 50 }
  ],
  "moderators": ["0x..."],
  "additionalValidators": ["0x..."],
  "additionalAgents": ["0x..."],
  "blacklistedAgents": [],
  "blacklistedValidators": [],
  "transferOwnershipTo": "0xMultisig..."
}
```

### 2) Environment variable overrides
All parameters can be supplied via `.env` variables (see `.env.example`). The script accepts either JSON config **or** env vars:

```bash
AGIJOBMANAGER_ADDRESS=0x... \
AGI_REQUIRED_VALIDATOR_APPROVALS=3 \
AGI_REQUIRED_VALIDATOR_DISAPPROVALS=3 \
AGI_VALIDATION_REWARD_PERCENTAGE=8 \
truffle exec scripts/postdeploy-config.js --network sepolia
```

### 3) Dry run (no transactions)

```bash
AGI_CONFIG_PATH=/path/to/config.json \
truffle exec scripts/postdeploy-config.js --network sepolia --address 0x... --dry-run
```

**Safe order** enforced by the script:
1. Parameter updates (validation reward vs AGI type + additional agent payout updates are ordered based on payout headroom)
2. AGI type updates / additional agent payout updates (if not already applied before validation reward)
3. Moderator/additional lists & blacklists
4. Ownership transfer (last)

## Read-only verification (scripted)

```bash
AGI_CONFIG_PATH=/path/to/config.json \
truffle exec scripts/verify-config.js --network <network> --address <AGIJobManagerAddress>
```

The output is machine-readable with `PASS` / `FAIL` lines.
Set `AGI_EXPECTED_OWNER` (or include `expectedOwner` in the JSON config) to validate the owner address.

## Post-deploy verification checklist

### Read-only checks (no transactions)

- Owner is the expected multisig/hardware key.
- Contract is **unpaused** (or intentionally paused for incident response).
- ENS / NameWrapper / root nodes match the deployment record.
- Merkle roots match the allowlist artifacts used at deploy.

Suggested commands:

```bash
truffle exec scripts/verify-config.js --network <network> --address <AGIJobManagerAddress> --config-path /path/to/config.json
truffle exec scripts/ops/validate-params.js --network <network> --address <AGIJobManagerAddress>
```

### Invariants & sanity checks

- `requiredValidatorApprovals`, `requiredValidatorDisapprovals` respect `MAX_VALIDATORS_PER_JOB`.
- `validationRewardPercentage` is 1–100.
- `validationRewardPercentage + maxAgentPayoutPercentage <= 100`.
- `maxJobPayout > 0`, `jobDurationLimit > 0`.
- `completionReviewPeriod <= 365 days`, `disputeReviewPeriod <= 365 days`.

### Recommended testnet smoke test

1. Create a job with small payout and duration.
2. Have an agent apply and request completion.
3. Have validators approve to hit the approval threshold.
4. Verify job settles and the NFT is minted.
5. Optionally: trigger a dispute and resolve it via moderator.

## Bytecode size guard

To ensure runtime bytecode remains within the EIP‑170 limit (24,576 bytes):

```bash
npm run size
```

## Compiler warnings (if any)

No Solidity compiler warnings were observed in the latest local build. If warnings appear later (e.g., from vendor inline assembly), document the source, impact, and the smallest safe remediation path (such as a targeted dependency upgrade).

## Known issues

No failing tests observed in the latest local run.
