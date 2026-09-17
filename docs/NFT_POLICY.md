# Agent NFT policy — v0.9.4

The owner can require or waive an approved NFT for **newly posted jobs**. NFTs are required by default. Each job records the choice when its `createJob` transaction executes, before assignment; changing the default never changes an existing job.

| Job policy | Agent needs |
| --- | --- |
| Required | Agent authorization, an NFT from an enabled ERC-721 collection, and the required USDC bond |
| Not required | Agent authorization and the required USDC bond |

Both modes enforce blacklists, job state, capacity limits and pause controls. Ordinary agents use `agent.agi.eth` or `alpha.agent.agi.eth`; validators use `club.agi.eth` or `alpha.club.agi.eth`. Existing owner allowlists and Merkle proofs remain explicit membership exceptions. Turning off the NFT requirement does not change those ENS rules or waive validator authorization.

NFTs determine eligibility at application, not payment amounts. Successful settlement still pays validators first (8% default), then 30% and 10% of the original job cost to the two wallets, then the agent remainder. NFT ownership is not checked again at settlement. The employer's completion NFT is separate and is still minted on successful completion.

## Owner walkthrough

1. Open the versioned [USDC console](https://github.com/MontrealAI/AGIJobManager/releases/download/v0.9.4/agijobmanager-usdc.html), select the verified v0.9.4 manager and connect the accepted owner wallet. Confirm the chain and contract address.
2. In owner controls, choose **NFT requirement for new jobs**. Enter `true` to require an enabled NFT or `false` to waive it. Review and simulate the transaction, then submit through the owner's signing setup.
3. Verify `AgentNftRequirementUpdated(required)` and `agentNftRequired()`. A pending owner has no authority until ownership is accepted. This operational setting remains available after identity configuration is locked.
4. Agents and employers check `jobAgentNftRequired(jobId)` or the console's job detail/review for the actual job policy. Missing or cancelled jobs revert instead of reporting an optional policy.

`setAgentNftRequired(bool)` does not require a pause or empty reserves because it affects only future jobs. Posting transactions record the setting at execution time. The console checks for changed terms before submission and after USDC approval; a later ordering change before mining can still alter which default a new job records. Verify the mined job's getter afterward.

## Configure approved collections

A fresh manager has **no registered collections**. Keeping the required default without configuring a collection prevents agents from applying. After accepting ownership, either register reviewed collections or explicitly choose the optional mode before activation.

`addAGIType(collection, score)` adds or updates an ERC-721 collection with an integer score from 1 to 100. `disableAGIType(collection)` sets its score to zero. There are at most 32 slots; disabled slots can be reused when full. The historical names `payoutPercentage` and `getHighestPayoutPercentage` are retained for compatibility: any positive score establishes eligibility and never increases the payment share. Select **1** unless compatibility with existing score reporting needs another value.

**Every collection addition, score update, disable or slot reuse requires all four reserve counters to be zero:** `lockedEscrow`, `lockedAgentBonds`, `lockedValidatorBonds`, `lockedDisputeBonds`. This applies in both modes and prevents changing the accepted collection list under funded jobs. To change the registry, pause intake, allow existing jobs to finish or be cancelled/refunded through their normal paths, verify all four counters, then change and verify the registry before reopening intake. Donations outside reserves do not block this process.

Disabling the default does not waive the requirement for an older required job. If its credential becomes unavailable before assignment, the employer can cancel that unassigned job and post a replacement under newly reviewed terms. Assigned jobs can settle without holding the NFT. The manager cannot freeze an external NFT's ownership, upgrade authority or availability; review those collection risks separately.

## Hardhat deployment and readiness

The supported deployment script deploys and verifies six linked libraries, including `NftEligibility`, and the manager. It starts intake paused, retains the required default and empty registry, and proposes the configured ownership handover. It does not choose production collections or silently turn eligibility off.

After ownership acceptance and on-chain configuration, create `hardhat/reviewed-nft-policy.json` describing the **complete expected registry**, including disabled entries. For a required policy:

```json
{
  "agentNftRequired": true,
  "agiTypes": [
    { "nftAddress": "REPLACE_WITH_REVIEWED_ERC721_ADDRESS", "payoutPercentage": "1" }
  ]
}
```

Replace the placeholder with the verified collection address. For an intentionally optional policy on a fresh manager with no registered collections:

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

This release changes manager bytecode. It requires a **fresh v0.9.4 manager**, even if an earlier USDC manager exists. There is no proxy upgrade or escrow migration. Keep every earlier job on its original manager, asset, helper and ENS namespace, using that version's interface. A fresh manager needs a distinct jobs namespace because IDs restart at zero. Do not overwrite old receipts or relabel old addresses as v0.9.4.

The regression suite covers both modes, repeated default changes, accepted-owner authority, collection protection, eligibility, bonds and identical payouts after transferring away an NFT. Fuzzing exercises both policy orders and varying costs/reward rates. The pinned mainnet fork repeats both modes against actual Circle USDC and ENS contracts while comparing the legacy inventory. It uses a mock eligibility collection: actual production collections, owners, recipients, signer access and activation still require instance-specific review. See [qualification](qualification/USDC_CUTOVER.md) and [mainnet readiness](MAINNET_READINESS.md).
