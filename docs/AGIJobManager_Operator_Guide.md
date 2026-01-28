# AGIJobManager Operator Guide

This runbook is for operators deploying and administering `AGIJobManager`.

## Deployment

### Constructor arguments
```
constructor(
  address _agiTokenAddress,
  string _baseIpfsUrl,
  address _ensAddress,
  address _nameWrapperAddress,
  bytes32 _clubRootNode,
  bytes32 _agentRootNode,
  bytes32 _validatorMerkleRoot,
  bytes32 _agentMerkleRoot
)
```

| Arg | Description |
| --- | --- |
| `_agiTokenAddress` | ERC-20 token used for job escrow and NFT marketplace payments. |
| `_baseIpfsUrl` | Base URL used to build token URI (e.g., `ipfs://`). |
| `_ensAddress` | ENS registry address for the target chain. |
| `_nameWrapperAddress` | ENS NameWrapper address for the target chain. |
| `_clubRootNode` | ENS root node for validator subdomains. |
| `_agentRootNode` | ENS root node for agent subdomains. |
| `_validatorMerkleRoot` | Merkle root allowlisting validators. |
| `_agentMerkleRoot` | Merkle root allowlisting agents. |

### Recommended deployment checklist
1. Confirm the ERC-20 token is live and returns `true` on `transfer`/`transferFrom`.
2. Set ENS + NameWrapper addresses that match the deployment network.
3. Validate `clubRootNode` and `agentRootNode` against expected ENS names.
4. Build Merkle roots from allowlisted addresses (see docs in `AGIJobManager.md`).
5. Deploy, then set optional metadata (terms hash, contact email, additional text) as needed.

## Default parameters
The contract has the following defaults (can be updated by the owner):

| Parameter | Default | Purpose |
| --- | --- | --- |
| `requiredValidatorApprovals` | `3` | Approvals to complete a job. |
| `requiredValidatorDisapprovals` | `3` | Disapprovals to mark dispute. |
| `premiumReputationThreshold` | `10000` | Reputation required for premium feature access. |
| `validationRewardPercentage` | `8` | % of payout reserved for validators. |
| `maxJobPayout` | `4888e18` | Max ERC-20 payout per job. |
| `jobDurationLimit` | `10000000` | Max duration (seconds). |

## Admin operations

### Pausing
- `pause()` / `unpause()` are owner-only.
- **Paused** blocks: `createJob`, `applyForJob`, `requestJobCompletion`, `validateJob`, `disapproveJob`, `disputeJob`, and `contributeToRewardPool`.
- **Paused** does **not** block: `cancelJob`, `resolveDispute`, `listNFT`, `purchaseNFT`, `delistNFT`, or admin setters.

### Blacklists
- `blacklistAgent(address,bool)` and `blacklistValidator(address,bool)` are owner-only.
- Blacklisted users cannot apply or validate/disapprove.

### Moderator management
- `addModerator` / `removeModerator` control who can resolve disputes.

### Allowlist bypass
- `addAdditionalAgent` / `addAdditionalValidator` allow addresses to skip ENS/Merkle checks.
- Use sparingly to avoid bypassing identity expectations.

### AGI types
- `addAGIType(nftAddress, payoutPercentage)` sets the payout percentage for holders of a specific ERC-721.
- The highest percentage across all `agiTypes` is used for agent payout.

### Withdrawing funds
- `withdrawAGI(amount)` transfers ERC-20 from the contract to the owner.
- **Caveat:** This can reduce the contract’s ability to pay out jobs if escrow totals are exceeded by payouts. Treat it as a treasury operation.

### Rotating the ERC-20 token
- `updateAGITokenAddress` changes the token used for all future escrow and marketplace payments.
- **Operational risk:** Existing escrow balances are held in the old token. Consider withdrawing or reconciling before rotating.

## Operational guidance

### Safe parameter tuning
- Keep `requiredValidatorApprovals` and `requiredValidatorDisapprovals` balanced to prevent trivial disputes.
- Ensure `validationRewardPercentage + max expected agent payout %` does not exceed 100 unless you are intentionally subsidizing with treasury funds.
- Use `jobDurationLimit` to prevent long-running unbounded jobs.

### Disaster recovery
- If a validator or agent allowlist is compromised, rotate the Merkle roots by redeploying (no on-chain root update in current code).
- For disputes that need off-chain intervention, add a moderator and use `resolveDispute` with clear resolution strings.
