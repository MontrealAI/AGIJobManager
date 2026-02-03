# Troubleshooting & Common Errors

This guide explains why transactions fail and what to check before retrying.

## Custom errors (from the contract)
| Error | Meaning | Common triggers | Fix |
| --- | --- | --- | --- |
| `NotModerator` | Caller is not a moderator | `resolveDisputeWithCode` called by non‑moderator | Ask owner to add moderator |
| `NotAuthorized` | Caller fails identity checks | Wrong subdomain, missing Merkle proof, not allowlisted | Verify subdomain, proof, or allowlist |
| `Blacklisted` | Address is blocked | `applyForJob`, `validateJob`, `disapproveJob` while blacklisted | Ask owner to remove blacklist |
| `InvalidParameters` | Inputs out of range | payout=0, duration=0, price=0, invalid percent | Fix input values |
| `InvalidState` | Action not allowed in current job state | Completed/assigned/disputed, expired duration | Check job status first |
| `JobNotFound` | jobId does not exist | Using wrong jobId | Verify jobId from `JobCreated` |
| `TransferFailed` | ERC‑20 transfer/transferFrom failed | Insufficient allowance/balance, token returns false | Increase allowance/balance or fix token |

## Pausable errors
If the contract is paused, most user actions revert with `Pausable: paused`.
- **Fix**: wait for the owner to unpause.

## Common pitfalls
### Wrong subdomain string
- The contract computes `subnode = keccak256(root, keccak256(subdomain))`.
- A typo in the subdomain will fail identity checks.

### Missing ERC‑20 allowance
- **createJob** and **purchaseNFT** require a prior `approve`.
- Approve only the exact amount and revoke after use.

### Job expired
- `requestJobCompletion` will fail if the job duration has expired.

### Double voting
- Validators cannot approve or disapprove twice.

### Dispute status
- `resolveDisputeWithCode` only works when `disputed == true`.
- `disputeJob` can only be called by employer or assigned agent.

## How to diagnose
1. Check the revert error in your wallet or Etherscan.
2. Look up the last emitted event for the job.
3. Compare the job state (`getJobCore(jobId)` / `getJobValidation(jobId)`) with the requirements above.
