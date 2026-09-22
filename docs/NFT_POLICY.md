# Agent NFT policy

> Current guide for this source checkout. See [release identity and deployment commands](RELEASE_GUIDE.md).

The owner can require or waive an approved NFT for **newly posted jobs**. Fresh managers start with NFT eligibility **disabled** (`agentNftRequired() == false`) and no registered collections. The owner can opt in later. Each job records the choice when its `createJob` transaction executes, before assignment; changing the default never changes an existing job.

| Job policy | Agent needs |
| --- | --- |
| Required | Agent authorization, an NFT from an enabled ERC-721 collection, and the required USDC bond |
| Not required | Agent authorization and the required USDC bond |

Both modes enforce blacklists, job state, capacity limits and pause controls. Ordinary agents use `agent.agi.eth` or `alpha.agent.agi.eth`; validators use `club.agi.eth` or `alpha.club.agi.eth`. Existing owner allowlists and Merkle proofs remain explicit membership exceptions. Turning off the NFT requirement does not change those ENS rules or waive validator authorization.

NFTs determine eligibility at application, not payment amounts. Successful settlement still pays validators first (8% default), then 30% and 10% of the original job cost to the two wallets, then the agent remainder. NFT ownership is not checked again at settlement. The employer's completion NFT is separate and is still minted on successful completion.

## Owner walkthrough

1. Open the versioned [USDC console](https://github.com/MontrealAI/AGIJobManager/releases/download/v1.9.0/agijobmanager-usdc.html), select the verified compatible manager and connect the accepted owner wallet. Confirm the chain and contract address.
2. In owner controls, choose **NFT requirement for new jobs**. Enter `true` to require an enabled NFT or `false` to waive it. Review and simulate the transaction, then submit through the owner's signing setup.
3. Verify `AgentNftRequirementUpdated(required)` and `agentNftRequired()`. A pending owner has no authority until ownership is accepted. This operational setting remains available after identity configuration is locked.
4. Agents and employers check `jobAgentNftRequired(jobId)` or the console's job detail/review for the actual job policy. Missing or cancelled jobs revert instead of reporting an optional policy.

`setAgentNftRequired(bool)` does not require a pause or empty reserves because it affects only future jobs. Posting transactions record the setting at execution time. The console checks for changed terms before submission and after USDC approval; a later ordering change before mining can still alter which default a new job records. Verify the mined job's getter afterward.

## Configure approved collections

A fresh manager has **no registered collections** and NFT admission is **disabled**. No NFT-setting transaction is needed to keep that starting policy. To opt in, the accepted owner registers reviewed collections and calls `setAgentNftRequired(true)` before the jobs that should require them are posted. Enabling the requirement with no enabled collection prevents agents from applying and fails readiness.

`addAGIType(collection, score)` adds or updates an ERC-721 collection with an integer score from 1 to 100. `disableAGIType(collection)` sets its score to zero. There are at most 32 slots; disabled slots can be reused when full. The historical names `payoutPercentage` and `getHighestPayoutPercentage` are retained for compatibility: any positive score establishes eligibility and never increases the payment share. Select **1** unless compatibility with existing score reporting needs another value.

**Every collection addition, score update, disable or slot reuse requires all four reserve counters to be zero:** `lockedEscrow`, `lockedAgentBonds`, `lockedValidatorBonds`, `lockedDisputeBonds`. This applies in both modes and prevents changing the accepted collection list under funded jobs. To change the registry, pause intake, allow existing jobs to finish or be cancelled/refunded through their normal paths, verify all four counters, then change and verify the registry before reopening intake. Donations outside reserves do not block this process.

Disabling the default does not waive the requirement for an older required job. If its credential becomes unavailable before assignment, the employer can cancel that unassigned job and post a replacement under newly reviewed terms. Assigned jobs can settle without holding the NFT. The manager cannot freeze an external NFT's ownership, upgrade authority or availability; review those collection risks separately.

## Enable the free Alpha Agent Identity route

Use this setup only after reviewing the intended manager and collection. It describes supported configuration, not a claim that a live manager is already configured. If jobs keep the disabled NFT default, agents still need authorization through ENS or an explicit exception, but registering an NFT collection is unnecessary. Follow the collection steps when opting into the NFT requirement.

| Check | Required configuration |
| --- | --- |
| ENS integration | Reviewed Ethereum mainnet ENS registry and NameWrapper addresses |
| Alpha-agent root | `alphaAgentRootNode()` equals the ENS namehash of `alpha.agent.agi.eth` |
| Identity collection | Enable the verified [FreeTrialSubdomainRegistrarIdentity ERC-721 contract](https://etherscan.io/address/0x7811993CbcCa3b8bb35a3d919F3BA59eeFbeAA9a#code), `0x7811993CbcCa3b8bb35a3d919F3BA59eeFbeAA9a`, with a positive score |
| Job NFT policy | Read `jobAgentNftRequired(jobId)` for existing jobs; `agentNftRequired()` is only the default for future postings |
| Applying wallet | Pass ENS authorization, hold the enabled NFT when required, and meet the job, bond, capacity, blacklist and pause checks |

1. Connect the **accepted owner** to the verified manager while intake is paused. Confirm all four escrow/bond counters are zero before changing roots or collections. Keep existing jobs on their normal settlement/refund paths.
2. Read all four roots. If a correction is needed and `lockIdentityConfig()` is false, call `updateRootNodes(clubRootNode, agentRootNode, alphaClubRootNode, alphaAgentRootNode)` with all four reviewed namehashes in that exact order. Preserve the intended other roots. A namehash is a `bytes32` value, not the name text or a simple hash of the full string. If already correct, no root transaction is needed; if locked and incorrect, this setter cannot repair it.
3. On the **manager**, call `addAGIType(0x7811993CbcCa3b8bb35a3d919F3BA59eeFbeAA9a, 1)`. The `1` is an eligibility score, not a 1% payout. Read back the collection's `agiTypes(index)` entry and include it in the complete reviewed readiness policy below.
4. To require NFTs on future jobs, the accepted owner calls `setAgentNftRequired(true)` and verifies `agentNftRequired()`. To retain the fresh optional policy, leave it `false`. Existing jobs keep their posting-time requirement.
5. Confirm the intended participant wallet’s ENS route, collection balance and `getHighestPayoutPercentage(wallet) > 0`. A positive score alone does not identify which collection qualified or prove complete eligibility. Complete the [launch checks](LAUNCH_CHECKLIST.md), including a separate rehearsal, before opening intake.
6. After authorized activation, use a limited first job and simulate its application with the intended agent wallet and sufficient bond allowance before signing. Application simulation while intake is paused is expected to revert; do not bypass that guard.

The NFT registry remains owner-maintainable after the ENS identity lock, subject to empty escrow/bond reserves. Root/registry configuration does not register a user's name: the user separately registers through the registrar, paying ETH gas. Agent credentials do not grant validator membership.

**Trial expiry is not enforced by the NFT balance check.** An expired identity can remain unburned; the manager does not query registrar expiry. Separate status monitoring is an operational check, not an on-chain admission guarantee. A strict expiry-aware NFT gate would require a contract change and a separately qualified deployment. Existing assignments are not revoked merely because credentials expire; identity/NFT admission checks are not repeated at payment. See [registration and expiry details](guides/IDENTITY_AND_PROOFS.md#free-alpha-agent-name-and-identity-nft).

## Hardhat deployment and readiness

The supported deployment script deploys and verifies eight linked libraries, including `NftEligibility`, and the manager. It starts intake paused with NFT admission disabled and an empty registry, checks the disabled state at the deployment block, and proposes the configured ownership handover. It does not choose production collections or enable NFT admission.

Run `npm --prefix hardhat run setup` to create a private policy example without overwriting existing files. After ownership acceptance and on-chain configuration, review `hardhat/reviewed-nft-policy.json` describing the **complete expected registry**, including disabled entries. For a required policy:

```json
{
  "agentNftRequired": true,
  "agiTypes": [
    { "nftAddress": "REPLACE_WITH_REVIEWED_ERC721_ADDRESS", "payoutPercentage": "1" }
  ]
}
```

Replace the placeholder with the verified collection address and enable that policy on chain before checking readiness. The setup-generated policy matches fresh v1.0.3 construction:

```json
{
  "agentNftRequired": false,
  "agiTypes": []
}
```

Do not omit previously registered entries merely because the default is optional. A disabled entry remains in the registry with score `"0"`. Array order is ignored; addresses, scores and the boolean must match. This file expresses expected state and sends no transactions.

From `hardhat/`:

```bash
READINESS_NFT_CONFIG=./reviewed-nft-policy.json \
DEPLOYMENT_RECEIPT=deployments/mainnet/<saved-receipt>.json \
npm run check:readiness
```

Use `check:readiness:sepolia` and the Sepolia receipt for that rehearsal. `READINESS_CONFIG` remains a separate optional file for reviewed ENS/Merkle changes. The checker rejects missing or malformed NFT policy files, unreviewed state, required mode without an enabled collection, missing enabled collection code and all existing deployment/readiness failures. It records the policy-file hash and collection runtime hashes at the same checked block as ownership, ENS, USDC and reserves. It does not establish individual NFT balances or control over production signers. Complete that operational review before the owner opens intake.

The local-only owner configuration CLI also accepts `agentNftRequired: true/false` or `AGI_AGENT_NFT_REQUIRED=true/false`; `--dry-run` previews and `scripts/verify-config.js` checks the setting. Public owner transactions use the verified console, explorer or governance wallet; the local CLI remains blocked from public-chain writes.

## Existing deployments and qualification

The per-job NFT policy was introduced in v0.9.4. v1.0.3 changes the construction default from required to disabled and retains the v0.9.6 ABI and deployed runtime bytecode, so a verified v0.9.6 manager remains compatible with this console. Existing deployed settings do not change on publication: to disable the requirement on a compatible older instance, its accepted owner calls `setAgentNftRequired(false)` and verifies the resulting state. Earlier required jobs remain required. First deployments and moves from incompatible older versions require a fresh manager. There is no proxy upgrade or escrow migration. Keep every earlier job on its original manager, asset, helper and ENS namespace, using a compatible interface. A fresh manager needs a distinct jobs namespace because IDs restart at zero. Do not overwrite old receipts or relabel old addresses as v1.0.3 deployments.

The regression suite covers both modes, repeated default changes, accepted-owner authority, collection protection, eligibility, bonds and identical payouts after transferring away an NFT. Fuzzing exercises both policy orders and varying costs/reward rates. The pinned mainnet fork repeats both modes against actual Circle USDC and ENS contracts while comparing the legacy inventory. It uses a mock eligibility collection: actual production collections, owners, recipients, signer access and activation still require instance-specific review. See [qualification](qualification/USDC_CUTOVER.md) and [mainnet readiness](MAINNET_READINESS.md).
