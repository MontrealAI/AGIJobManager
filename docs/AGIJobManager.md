# AGIJobManager Contract Documentation

This document is the primary, code-accurate guide to `AGIJobManager` as compiled from `contracts/AGIJobManager.sol`.

## 1) High-level overview

**What it is**
- A single-contract escrow job manager that:
  - Holds ERC-20 funds for jobs.
  - Tracks job lifecycle, validation, disputes, and reputation.
  - Mints an ERC-721 NFT to the employer when a job completes.
  - Provides a lightweight NFT listing + purchase flow using the same ERC-20 token.
  - Verifies agent/validator eligibility via Merkle roots and ENS/NameWrapper ownership checks.

**What it is not**
- Not an ERC-8004 on-chain registry. The ERC-8004 adapter lives off-chain and is documented separately.
- Not a full marketplace or escrow for arbitrary NFTs—only the job-minted ERC-721s are listed.
- Not a generalized identity registry; it relies on external ENS/NameWrapper behavior and Merkle roots.

## 2) Key components

- **Jobs**: Employer-funded entries with an IPFS hash, payout, duration, and status flags.
- **Agents**: Apply for jobs if allowlisted (Merkle/ENS/NameWrapper) or explicitly added.
- **Validators**: Validate or disapprove jobs, also allowlisted via Merkle/ENS/NameWrapper or explicitly added.
- **Moderators**: Resolve disputes with a canonical resolution string.
- **Dispute flow**: Disputes can be opened by employer/agent or triggered by validator disapprovals.
- **Reputation**: Earned by agents (and validators) based on payout/duration; capped with diminishing returns.
- **NFT issuance**: Completion mints ERC-721 to employer and sets tokenURI using base IPFS URL + job hash.
- **Marketplace**: Listing/purchase/delist functions for minted NFTs (payments in `agiToken`).

## 3) Roles & permissions

### Roles
- **Owner**: Contract-level admin (pause/unpause, set parameters, blacklist, withdraw, manage allowlists and AGI types, rotate token address).
- **Moderator**: Resolves disputes via `resolveDispute`.
- **Employer**: Creates/cancels jobs; can dispute jobs; receives NFT on completion.
- **Agent**: Applies for jobs and requests completion.
- **Validator**: Validates or disapproves jobs; earns rewards if the job completes.
- **NFT holder**: Uses ERC-721 functions and marketplace listing.

### Function access matrix
The table below lists **all public/external functions** and captures who can call them, the most important preconditions, and observable effects. “Anyone” includes EOAs and contracts.

| Function | Who can call | Preconditions (key checks) | Effects |
| --- | --- | --- | --- |
| `pause()` | Owner | None | Pauses job/validation/reward-pool flows guarded by `whenNotPaused`. |
| `unpause()` | Owner | None | Unpauses guarded flows. |
| `createJob(string,uint256,uint256,string)` | Anyone | Not paused; payout/duration > 0 and within `maxJobPayout`/`jobDurationLimit` | Creates job, escrow pulls ERC-20, emits `JobCreated`. |
| `applyForJob(uint256,string,bytes32[])` | Anyone | Not paused; job exists; unassigned; not blacklisted; authorized via allowlist/ENS | Assigns agent, sets `assignedAt`, emits `JobApplied`. |
| `requestJobCompletion(uint256,string)` | Assigned agent | Not paused; before `assignedAt + duration` | Updates job IPFS hash, sets `completionRequested`, emits `JobCompletionRequested`. |
| `validateJob(uint256,string,bytes32[])` | Validator | Not paused; job exists; assigned; not completed; not blacklisted; authorized; has not voted | Records approval, emits `JobValidated`; may complete job when approvals threshold met. |
| `disapproveJob(uint256,string,bytes32[])` | Validator | Not paused; job exists; assigned; not completed; not blacklisted; authorized; has not voted | Records disapproval, emits `JobDisapproved`; may mark job disputed when disapprovals threshold met. |
| `disputeJob(uint256)` | Employer or agent | Not paused; job exists; not completed; not already disputed | Sets `disputed`, emits `JobDisputed`. |
| `resolveDispute(uint256,string)` | Moderator | Job exists; `disputed == true` | If resolution is `"agent win"` → completes job; if `"employer win"` → refunds employer + marks completed; otherwise only clears `disputed`. Emits `DisputeResolved`. |
| `blacklistAgent(address,bool)` | Owner | None | Updates agent blacklist. |
| `blacklistValidator(address,bool)` | Owner | None | Updates validator blacklist. |
| `delistJob(uint256)` | Owner | Job exists; not completed; no agent assigned | Refunds employer, deletes job, emits `JobCancelled`. |
| `addModerator(address)` | Owner | None | Grants moderator role. |
| `removeModerator(address)` | Owner | None | Revokes moderator role. |
| `updateAGITokenAddress(address)` | Owner | None | Updates ERC-20 token used for escrow/payments. |
| `setBaseIpfsUrl(string)` | Owner | None | Updates base IPFS URL for minted tokenURI. |
| `setRequiredValidatorApprovals(uint256)` | Owner | None | Updates approval threshold. |
| `setRequiredValidatorDisapprovals(uint256)` | Owner | None | Updates disapproval threshold. |
| `setPremiumReputationThreshold(uint256)` | Owner | None | Updates premium feature threshold. |
| `setMaxJobPayout(uint256)` | Owner | None | Updates max payout. |
| `setJobDurationLimit(uint256)` | Owner | None | Updates max duration. |
| `updateTermsAndConditionsIpfsHash(string)` | Owner | None | Updates on-chain terms hash string. |
| `updateContactEmail(string)` | Owner | None | Updates on-chain contact string. |
| `updateAdditionalText1(string)` | Owner | None | Updates on-chain text field. |
| `updateAdditionalText2(string)` | Owner | None | Updates on-chain text field. |
| `updateAdditionalText3(string)` | Owner | None | Updates on-chain text field. |
| `getJobStatus(uint256)` | Anyone | None | Returns `(completed, completionRequested, ipfsHash)` (no job existence guard). |
| `setValidationRewardPercentage(uint256)` | Owner | `0 < percentage <= 100` | Updates validator reward percentage. |
| `cancelJob(uint256)` | Employer | Job exists; not completed; no agent assigned | Refunds employer, deletes job, emits `JobCancelled`. |
| `listNFT(uint256,uint256)` | NFT owner | `price > 0`; caller owns token | Creates/overwrites listing, emits `NFTListed`. |
| `purchaseNFT(uint256)` | Anyone | Listing active | Transfers ERC-20 payment and NFT, emits `NFTPurchased`. |
| `delistNFT(uint256)` | Listing seller | Listing active; caller is seller | Deactivates listing, emits `NFTDelisted`. |
| `addAdditionalValidator(address)` | Owner | None | Adds validator allowlist bypass. |
| `removeAdditionalValidator(address)` | Owner | None | Removes validator allowlist bypass. |
| `addAdditionalAgent(address)` | Owner | None | Adds agent allowlist bypass. |
| `removeAdditionalAgent(address)` | Owner | None | Removes agent allowlist bypass. |
| `withdrawAGI(uint256)` | Owner | `amount > 0` and `amount <= agiToken.balanceOf(this)` | Transfers ERC-20 to owner. |
| `canAccessPremiumFeature(address)` | Anyone | None | Returns true if reputation >= threshold. |
| `contributeToRewardPool(uint256)` | Anyone | Not paused; `amount > 0` | Transfers ERC-20 to contract, emits `RewardPoolContribution`. |
| `addAGIType(address,uint256)` | Owner | `nftAddress != 0`; `0 < payoutPercentage <= 100` | Adds/updates AGI type payout percent, emits `AGITypeUpdated`. |
| `getHighestPayoutPercentage(address)` | Anyone | None | Returns highest payout % for agent based on ERC-721 balances. |
| `jobs(uint256)` | Anyone | Job may or may not exist | Returns job fields (no mappings/validators array). |
| `listings(uint256)` | Anyone | None | Returns listing fields. |
| `reputation(address)` | Anyone | None | Returns current reputation. |
| `validatorApprovedJobs(address,uint256)` | Anyone | Index in array must exist | Returns job ID at index. |
| `agiTypes(uint256)` | Anyone | Index in array must exist | Returns AGI type at index. |
| `additionalAgents(address)` | Anyone | None | Returns allowlist bypass flag. |
| `additionalValidators(address)` | Anyone | None | Returns allowlist bypass flag. |
| `blacklistedAgents(address)` | Anyone | None | Returns blacklist flag. |
| `blacklistedValidators(address)` | Anyone | None | Returns blacklist flag. |
| `moderators(address)` | Anyone | None | Returns moderator flag. |
| `requiredValidatorApprovals()` | Anyone | None | Returns approval threshold. |
| `requiredValidatorDisapprovals()` | Anyone | None | Returns disapproval threshold. |
| `validationRewardPercentage()` | Anyone | None | Returns validator reward percentage. |
| `premiumReputationThreshold()` | Anyone | None | Returns premium threshold. |
| `maxJobPayout()` | Anyone | None | Returns max payout. |
| `jobDurationLimit()` | Anyone | None | Returns duration limit. |
| `agiToken()` | Anyone | None | Returns current ERC-20 token address. |
| `ens()` | Anyone | None | Returns ENS registry address. |
| `nameWrapper()` | Anyone | None | Returns NameWrapper address. |
| `clubRootNode()` | Anyone | None | Returns validator ENS root node. |
| `agentRootNode()` | Anyone | None | Returns agent ENS root node. |
| `validatorMerkleRoot()` | Anyone | None | Returns validator Merkle root. |
| `agentMerkleRoot()` | Anyone | None | Returns agent Merkle root. |
| `nextJobId()` | Anyone | None | Returns next job ID. |
| `nextTokenId()` | Anyone | None | Returns next token ID. |
| `termsAndConditionsIpfsHash()` | Anyone | None | Returns terms hash string. |
| `contactEmail()` | Anyone | None | Returns contact email string. |
| `additionalText1()` | Anyone | None | Returns text field. |
| `additionalText2()` | Anyone | None | Returns text field. |
| `additionalText3()` | Anyone | None | Returns text field. |
| `owner()` | Anyone | None | Returns owner address (Ownable). |
| `transferOwnership(address)` | Owner | `newOwner != 0` | Transfers ownership (Ownable). |
| `renounceOwnership()` | Owner | None | Renounces ownership (Ownable). |
| `paused()` | Anyone | None | Returns paused state. |
| `name()` | Anyone | None | Returns ERC-721 name. |
| `symbol()` | Anyone | None | Returns ERC-721 symbol. |
| `balanceOf(address)` | Anyone | `owner != 0` (ERC-721) | Returns ERC-721 balance. |
| `ownerOf(uint256)` | Anyone | Token must exist | Returns ERC-721 owner. |
| `tokenURI(uint256)` | Anyone | Token must exist | Returns token URI (ERC-721). |
| `approve(address,uint256)` | Token owner/approved | Token must exist (ERC-721) | Approves operator for token. |
| `getApproved(uint256)` | Anyone | Token must exist (ERC-721) | Returns approved address. |
| `setApprovalForAll(address,bool)` | Token owner | None | Sets operator approval. |
| `isApprovedForAll(address,address)` | Anyone | None | Returns operator approval status. |
| `transferFrom(address,address,uint256)` | Authorized operator | Token must exist; caller authorized (ERC-721) | Transfers token. |
| `safeTransferFrom(address,address,uint256)` | Authorized operator | Token must exist; caller authorized (ERC-721) | Safe transfer. |
| `safeTransferFrom(address,address,uint256,bytes)` | Authorized operator | Token must exist; caller authorized (ERC-721) | Safe transfer with data. |
| `supportsInterface(bytes4)` | Anyone | None | ERC-165 interface check. |

## 4) Lifecycle / state machine

### State transitions

```
Created (job exists, no agent) 
  ├─ applyForJob → Assigned
  ├─ cancelJob (employer) → Deleted + refunded
  └─ delistJob (owner) → Deleted + refunded

Assigned (assignedAgent set)
  ├─ requestJobCompletion → CompletionRequested (flag only)
  ├─ validateJob approvals >= threshold → Completed
  ├─ disapproveJob disapprovals >= threshold → Disputed
  └─ disputeJob (employer/agent) → Disputed

Disputed
  ├─ resolveDispute("agent win") → Completed
  ├─ resolveDispute("employer win") → Completed + employer refund
  └─ resolveDispute(other) → Dispute cleared (job remains incomplete)

Completed
  └─ terminal
```

### Flags and counters
- `assignedAgent` + `assignedAt`: Set once on `applyForJob`.
- `completionRequested`: Set to true on `requestJobCompletion` (does not gate validation).
- `validatorApprovals` / `validatorDisapprovals`: Incremented on vote (one per validator). Validators are appended to `validators` array on both approval and disapproval.
- `disputed`: Set when dispute is opened or disapproval threshold reached; cleared by `_completeJob` and `resolveDispute`.
- `completed`: Set in `_completeJob` or when moderator resolves in employer’s favor.

## 5) Token & accounting semantics

- **Escrow funding**: `createJob` pulls `payout` via `agiToken.transferFrom`.
- **Agent payout**: On completion, agent receives `payout * highestPayoutPercentage / 100`.
  - The percentage is determined by ERC-721 balances across `agiTypes` (see `getHighestPayoutPercentage`).
- **Validator payouts**: If any validators participated, the contract pays `payout * validationRewardPercentage / 100` total, split evenly across validators.
- **Totals can exceed 100%**: If agent payout % + validator reward % > 100, the contract pays more than the job’s escrow amount, using pooled contract balances.
- **Unused escrow**: If totals are less than 100% of payout, the remaining ERC-20 stays in the contract balance and can be withdrawn by the owner.
- **Refund paths**:
  - `cancelJob` (employer) or `delistJob` (owner) refunds escrow and deletes the job.
  - `resolveDispute("employer win")` refunds employer and closes the job.
- **ERC-20 expectations**: The contract requires `transfer`/`transferFrom` to return `true` and reverts with `TransferFailed` otherwise.

## 6) ENS / NameWrapper / Merkle ownership verification

Ownership checks are performed in `_verifyOwnership` and used by `applyForJob`, `validateJob`, and `disapproveJob`.

1. **Merkle allowlist**
   - Leaf: `keccak256(abi.encodePacked(claimant))`.
   - Merkle root:
     - If `rootNode == agentRootNode`, then `agentMerkleRoot` is used.
     - Otherwise, `validatorMerkleRoot` is used (validators pass `clubRootNode`).
   - Successful proof emits `OwnershipVerified` and returns `true`.

2. **NameWrapper ownership**
   - `subnode = keccak256(abi.encodePacked(rootNode, keccak256(bytes(subdomain))))`.
   - If `nameWrapper.ownerOf(uint256(subnode)) == claimant`, emits `OwnershipVerified`.
   - Any `Error(string)` or unexpected error triggers `RecoveryInitiated(reason)` or `RecoveryInitiated("NW_FAIL")`.

3. **ENS resolver**
   - If `ens.resolver(subnode)` is non-zero, `resolver.addr(subnode)` is checked against `claimant`.
   - Resolver call errors emit `RecoveryInitiated("RES_FAIL")`; missing resolver emits `RecoveryInitiated("NO_RES")`.

**Note:** `RecoveryInitiated` is informational only; ownership is not granted unless a proof/ownership check succeeds.

## 7) NFT issuance & marketplace

- **Minting**: `_completeJob` mints a new ERC-721 token to the employer.
- **Token URI**: `tokenURI = baseIpfsUrl + "/" + job.ipfsHash`.
- **Listing**: `listNFT` records a listing price in `agiToken` for the seller’s token.
- **Purchase**: `purchaseNFT` pulls `agiToken` from buyer to seller, then transfers the NFT.
- **Delisting**: `delistNFT` disables the listing for the seller.

## 8) Quickstart examples (ethers.js)

> These snippets assume you already have a signer and the deployed contract address.

### Approve + create job (employer)
```js
import { ethers } from "ethers";

const agi = new ethers.Contract(agiTokenAddress, erc20Abi, employerSigner);
const mgr = new ethers.Contract(jobManagerAddress, agiJobManagerAbi, employerSigner);

// Approve escrow
await agi.approve(jobManagerAddress, payout);

// Create job
await mgr.createJob(ipfsHash, payout, durationSeconds, details);
```

### Apply for job (agent)
```js
const mgr = new ethers.Contract(jobManagerAddress, agiJobManagerAbi, agentSigner);

await mgr.applyForJob(jobId, subdomain, merkleProof);
```

### Request completion (agent)
```js
await mgr.requestJobCompletion(jobId, completionIpfsHash);
```

### Validate job (validator)
```js
const mgr = new ethers.Contract(jobManagerAddress, agiJobManagerAbi, validatorSigner);

await mgr.validateJob(jobId, subdomain, merkleProof);
```

### Dispute + resolve (moderator)
```js
const mgr = new ethers.Contract(jobManagerAddress, agiJobManagerAbi, moderatorSigner);

await mgr.disputeJob(jobId); // by employer or agent
await mgr.resolveDispute(jobId, "agent win");
```

### Event subscriptions (ethers.js)
```js
mgr.on("JobCreated", (jobId, ipfsHash, payout, duration, details) => {
  console.log("JobCreated", jobId.toString());
});

mgr.on("JobCompleted", (jobId, agent, reputationPoints) => {
  console.log("JobCompleted", jobId.toString(), agent, reputationPoints.toString());
});

mgr.on("JobDisputed", (jobId, disputant) => {
  console.log("JobDisputed", jobId.toString(), disputant);
});

mgr.on("DisputeResolved", (jobId, resolver, resolution) => {
  console.log("DisputeResolved", jobId.toString(), resolution);
});
```

For the full ABI reference and detailed admin guidance, see:
- `docs/AGIJobManager_Interface.md`
- `docs/AGIJobManager_Operator_Guide.md`
- `docs/AGIJobManager_Security.md`
