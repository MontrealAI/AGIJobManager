# AGIJobManager Security Considerations

This document summarizes security considerations **specific to the current AGIJobManager contract**.

## Reentrancy posture
The contract uses OpenZeppelin `ReentrancyGuard` on the following functions:
- `createJob`
- `applyForJob`
- `validateJob`
- `disapproveJob`
- `disputeJob`
- `resolveDispute`
- `cancelJob`
- `withdrawAGI`
- `contributeToRewardPool`

Functions **without** `nonReentrant` include `requestJobCompletion`, `listNFT`, `purchaseNFT`, and `delistNFT`. `purchaseNFT` uses `transferFrom` (ERC-20) and `_transfer` (ERC-721) but does not call `safeTransferFrom` or any ERC-721 receiver hooks.

## Fixed issues vs. historical behavior
The repository test suite documents several behavior improvements over a prior version. The following improvements are baked into the current code:
- **Pre-apply takeover blocked**: a job cannot be reassigned once an agent is set.
- **Phantom job IDs blocked**: functions using `_job` revert if the job does not exist instead of acting on default data.
- **Disputed double-complete blocked**: disputes resolved with employer win close the job to prevent later completion.
- **Division-by-zero avoided**: agent-win dispute completion handles zero-validator cases safely.
- **Validator double-votes blocked**: validators cannot approve and disapprove the same job (or double vote).
- **Employer-win dispute properly closes** the job and refunds escrow.
- **Unchecked transfers fixed**: ERC-20 `transfer`/`transferFrom` return values are checked and revert on failure.
- **Failed refunds revert** instead of silently deleting jobs when token transfers fail.

## Remaining risks & assumptions
- **Owner power**: the owner can pause core flows, change token addresses, change validator thresholds, add AGI types, and withdraw escrowed funds. Integrators must trust the owner or constrain access via multisig.
- **Moderator trust**: moderators can resolve disputes with arbitrary strings. Only the canonical strings trigger on-chain actions.
- **Merkle root immutability**: there are no update functions for agent/validator Merkle roots or root nodes after deployment. A misconfigured root cannot be fixed on-chain.
- **ENS dependency**: `_verifyOwnership` depends on ENS registry + NameWrapper + resolver behavior. If these external contracts revert or are misconfigured, validation checks may fail.
- **ERC-20 return values**: transfers rely on the token returning `true`. Non-standard ERC-20 tokens that revert or return no boolean may not be compatible.
- **Agent payout percentage can be zero**: if no AGI type applies, the agent receives no payout and residual funds remain in the contract.
- **Validator rewards share**: validators are paid equally among all who voted; there is no weighting or slashing mechanism.
- **Public metadata fields**: `termsAndConditionsIpfsHash` and `additionalText*` are mutable by the owner; downstream consumers must treat them as mutable.

## Integration guidance
- **Dispute strings** must match exactly: `"agent win"` or `"employer win"` (case-sensitive, ASCII). Otherwise no payout/refund occurs.
- **Handle custom errors**: integrators should decode custom errors (e.g., `InvalidState`, `NotAuthorized`, `TransferFailed`) when calls revert.
- **Monitor events**: state changes are best tracked via events (`JobCreated`, `JobCompleted`, `JobDisputed`, `DisputeResolved`, NFT events, etc.).
