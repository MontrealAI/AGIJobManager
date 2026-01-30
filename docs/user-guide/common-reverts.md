# Common revert reasons (and fixes)

This guide is based **directly on the contract’s revert conditions**. It explains what failed and how to fix it without reading Solidity.

> ⚠️ **Subdomain label only**: If a call asks for a subdomain, use the **label only** (e.g., `helper`, **not** `helper.agent.agi.eth`). A full ENS name often causes `NotAuthorized`.

## Quick legend
- **Custom errors**: `NotAuthorized`, `NotModerator`, `Blacklisted`, `InvalidParameters`, `InvalidState`, `JobNotFound`, `TransferFailed`.
- **Other common reverts**: `Ownable: caller is not the owner`, `Pausable: paused`.

## Revert table

| What you tried to do | What you saw | What it means | How to fix it | Where to learn more |
| --- | --- | --- | --- | --- |
| Create a job | `InvalidParameters` | Payout or duration is zero/too large. | Choose payout > 0 and ≤ max payout; choose duration > 0 and ≤ duration limit. | [`happy-path.md`](happy-path.md), [`roles.md`](roles.md) |
| Create a job | `TransferFailed` | Token transfer from your wallet failed. | Ensure correct token, enough balance, and **approve** the contract. | [`happy-path.md`](happy-path.md) |
| Apply for a job | `JobNotFound` | Job ID doesn’t exist. | Check job ID in the UI/Etherscan. | [`happy-path.md`](happy-path.md) |
| Apply for a job | `InvalidState` | Job already has an assigned agent. | Pick a job that is still unassigned. | [`roles.md`](roles.md) |
| Apply for a job | `Blacklisted` | Your wallet is blacklisted as an agent. | Contact the operator to resolve. | [`roles.md`](roles.md) |
| Apply for a job | `NotAuthorized` | Identity checks failed. | Use **label only**, correct Merkle proof, or be explicitly allowlisted. | [`merkle-proofs.md`](merkle-proofs.md) |
| Request job completion | `NotAuthorized` | You are not the assigned agent. | Only the assigned agent can request completion. | [`roles.md`](roles.md) |
| Request job completion | `InvalidState` | Job duration expired. | Request completion before the duration ends. | [`happy-path.md`](happy-path.md) |
| Validate a job | `JobNotFound` | Job ID doesn’t exist. | Recheck job ID. | [`happy-path.md`](happy-path.md) |
| Validate a job | `InvalidState` | Job has no assigned agent or is already completed. | Validate only active, assigned jobs. | [`roles.md`](roles.md) |
| Validate a job | `Blacklisted` | Your wallet is blacklisted as a validator. | Contact the operator to resolve. | [`roles.md`](roles.md) |
| Validate a job | `NotAuthorized` | Identity checks failed. | Use **label only**, correct Merkle proof, or be explicitly allowlisted. | [`merkle-proofs.md`](merkle-proofs.md) |
| Validate a job | `InvalidState` | You already approved/disapproved. | Only vote once per job. | [`roles.md`](roles.md) |
| Disapprove a job | `InvalidState` | Job has no assigned agent or is already completed. | Disapprove only active, assigned jobs. | [`roles.md`](roles.md) |
| Disapprove a job | `NotAuthorized` | Identity checks failed. | Use **label only**, correct Merkle proof, or be explicitly allowlisted. | [`merkle-proofs.md`](merkle-proofs.md) |
| Dispute a job | `InvalidState` | Job is already disputed or completed. | Only dispute active, undisputed jobs. | [`happy-path.md`](happy-path.md) |
| Dispute a job | `NotAuthorized` | You are not the employer or assigned agent. | Only those two roles can dispute. | [`roles.md`](roles.md) |
| Resolve a dispute | `NotModerator` | You are not a moderator. | Ask the owner to add you as moderator. | [`roles.md`](roles.md) |
| Resolve a dispute | `InvalidState` | Job is not disputed. | Only resolve when the job is in dispute. | [`roles.md`](roles.md) |
| Cancel a job | `NotAuthorized` | You are not the employer. | Only the employer can cancel. | [`roles.md`](roles.md) |
| Cancel a job | `InvalidState` | Job already assigned or completed. | Cancel only before assignment. | [`roles.md`](roles.md) |
| Delist a job (owner) | `Ownable: caller is not the owner` | You are not the owner. | Use the owner wallet. | [`roles.md`](roles.md) |
| Delist a job (owner) | `InvalidState` | Job already assigned or completed. | Delist only before assignment. | [`roles.md`](roles.md) |
| List an NFT | `NotAuthorized` | You are not the NFT owner. | Only the NFT owner can list. | [`roles.md`](roles.md) |
| List an NFT | `InvalidParameters` | Price is zero. | Set a price > 0. | [`roles.md`](roles.md) |
| Purchase an NFT | `InvalidState` | Listing is not active. | Choose an active listing. | [`roles.md`](roles.md) |
| Purchase an NFT | `TransferFailed` | Token transfer failed. | Approve the contract and ensure balance. | [`happy-path.md`](happy-path.md) |
| Delist an NFT | `NotAuthorized` | You are not the seller or listing is inactive. | Only the seller can delist an active listing. | [`roles.md`](roles.md) |
| Withdraw AGI (owner) | `InvalidParameters` | Amount is zero or exceeds balance. | Use a valid amount within contract balance. | [`roles.md`](roles.md) |
| Contribute to reward pool | `InvalidParameters` | Amount is zero. | Use a non‑zero amount. | [`roles.md`](roles.md) |
| Add AGI type | `InvalidParameters` | NFT address is zero or payout % is invalid. | Provide a valid address and 1–100%. | [`roles.md`](roles.md) |
| Set validator reward % | `InvalidParameters` | Percentage is 0 or > 100. | Use 1–100. | [`roles.md`](roles.md) |
| Any action while paused | `Pausable: paused` | The contract is paused by the owner. | Wait for unpause or contact operator. | [`roles.md`](roles.md) |

## Still stuck?
- Double‑check **network**, **contract address**, and **token address**.
- Ensure you’re using the correct **wallet** for the role.
- If you rely on identity checks, verify **label‑only** subdomain and proof format.
