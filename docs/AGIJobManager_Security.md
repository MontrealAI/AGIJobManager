# AGIJobManager Security Considerations

This document highlights security properties, assumptions, and known fixes relative to the legacy v0 contract.

## Reentrancy posture
- `nonReentrant` is applied to: `createJob`, `applyForJob`, `validateJob`, `disapproveJob`, `disputeJob`, `resolveDispute`, `cancelJob`, `withdrawAGI`, and `contributeToRewardPool`.
- Functions **without** `nonReentrant` include `requestJobCompletion`, `listNFT`, `purchaseNFT`, `delistNFT`, and admin setters.
  - `purchaseNFT` performs an external ERC-20 `transferFrom` prior to NFT transfer; this relies on the ERC-20 token being well-behaved.

## Known fixes vs legacy v0
The regression suite documents the following issues fixed in the current contract:
- **Pre-apply takeover**: Prevents agents from applying before a job exists (`JobNotFound`).
- **Double-complete on disputed jobs**: Clears `disputed` and enforces `completed` to prevent double payout.
- **Division-by-zero on zero validators**: Skips validator payout when no validators participated.
- **Double-vote validator edge case**: Prevents the same validator from both approving and disapproving.
- **Employer-win dispute still completing**: Employer refund now closes the job to prevent later completion.
- **Unchecked ERC-20 transfer on refunds**: Refunds now revert if ERC-20 transfers fail.

See `docs/REGRESSION_TESTS.md` for detailed coverage and test intent.

## Remaining risks & assumptions

- **Centralized powers**: The owner can pause, blacklist, withdraw funds, add moderators, and rotate the ERC-20 token. This is an intentional trust model.
- **Moderator trust**: Moderators can finalize disputes with resolution strings that control payout behavior.
- **ENS / NameWrapper dependencies**: Ownership checks rely on external ENS and NameWrapper contracts and resolver responses.
- **Merkle root management**: The current contract has no on-chain root update; changing allowlists requires redeploying or using `additionalAgents`/`additionalValidators`.
- **ERC-20 behavior**: The escrow token must return `true` on transfers; non-standard tokens can break flows.
- **Payout exceeding escrow**: If agent payout percentage + validator reward percentage exceeds 100%, the contract pays from its pooled balance.
- **Validation without completion request**: Validators can approve/disapprove even if the agent hasn’t called `requestJobCompletion`.

## Best-practice guidance
- Use a standard ERC-20 token with strict `transfer`/`transferFrom` semantics.
- Ensure validator + agent payout percentages are sustainable.
- Use additional allowlists sparingly and audit moderator actions off-chain.
