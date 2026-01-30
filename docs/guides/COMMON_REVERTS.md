# Common revert reasons (non‑technical)

This guide maps **real contract errors** to what you were trying to do, why it failed, and how to fix it. All entries are derived from `contracts/AGIJobManager.sol`.

## Quick checklist before retrying

- [ ] **Network**: You are on the correct chain.
- [ ] **Contract address**: The UI points to the intended deployment.
- [ ] **Token allowance**: AGI allowance is high enough for your action.
- [ ] **Token balance**: Your wallet has enough AGI for payouts or purchases.
- [ ] **Role eligibility**: Your agent/validator identity passes the preflight check.
- [ ] **Job state**: The job is in the correct status for your action.

## Revert table

| What you tried to do | What you saw | What it means (plain language) | How to fix it | Where to learn more |
| --- | --- | --- | --- | --- |
| Resolve a dispute | `NotModerator` | Your wallet is not a registered moderator. | Use a moderator wallet or ask the owner to add your address. | Roles → Moderator, Happy Path → Moderator flow |
| Apply for a job / Validate / Disapprove | `NotAuthorized` | You are not eligible for the role (agent/validator). | Ensure you’re on the additional allowlist **or** provide a valid Merkle proof **or** own the ENS subdomain via NameWrapper/resolver. Use **label only** (not full ENS name). | Roles → Agent/Validator, Merkle Proofs |
| Request completion / Dispute / Cancel | `NotAuthorized` | You are not the assigned agent or employer for this job. | Use the correct wallet for the job, or confirm the job’s assigned agent/employer. | Roles → Employer/Agent |
| List an NFT / Delist an NFT | `NotAuthorized` | You are not the token owner or the listing seller. | Use the wallet that owns the NFT or created the listing. | Happy Path → Marketplace flow |
| Any agent/validator action | `Blacklisted` | Your wallet is explicitly blocked for that role. | Ask the owner to remove you from the blacklist, or use a different wallet. | Roles → Agent/Validator |
| Create job / Owner parameter changes / Withdraw / Contribute | `InvalidParameters` | One or more inputs are invalid (zero, over max, or out of range). | Check payout/duration limits, reward %, listing price, or withdrawal amount. | Happy Path → Employer flow |
| Apply for a job | `InvalidState` | The job already has an assigned agent. | Choose a job that is still open. | Happy Path → Employer/Agent flow |
| Request completion | `InvalidState` | The job duration expired before you requested completion. | Request completion earlier or ask the employer to dispute if needed. | Happy Path → Agent flow |
| Validate / Disapprove | `InvalidState` | The job is completed, not assigned, or you already voted. | Validate only in‑progress jobs and only once per validator. | Roles → Validator |
| Dispute a job | `InvalidState` | The job is already disputed or completed. | Only dispute active, non‑disputed jobs. | Happy Path → Employer/Agent flow |
| Resolve a dispute | `InvalidState` | The job is not in a disputed state. | Check the job status and dispute first if appropriate. | Happy Path → Moderator flow |
| Cancel / Delist a job | `InvalidState` | The job is already assigned or completed. | Cancel/delist only before assignment. | Roles → Employer/Owner |
| Purchase an NFT | `InvalidState` | The listing is not active. | Ask the seller to list again or choose a listed token ID. | Happy Path → Marketplace flow |
| Any job action | `JobNotFound` | The job ID does not exist or was deleted/cancelled. | Confirm the job ID in the UI and try again. | Happy Path → Employer/Agent flow |
| Create job / Purchase NFT / Contribute / Withdraw | `TransferFailed` | Token transfer failed (insufficient balance/allowance or non‑standard ERC‑20). | Ensure balance and allowance are sufficient; confirm the token address from the contract. | Happy Path → Before you start |
| Any action while paused | `Pausable: paused` | The contract is paused by the owner. | Wait for unpause or contact the owner. | Roles → Owner |
| List/transfer a non‑existent NFT | `ERC721: invalid token ID` | The NFT token ID does not exist. | Use a valid token ID from the NFTs table. | Happy Path → Marketplace flow |

## Special focus: identity & ENS failures

If you see `NotAuthorized` while applying/validating, the most common causes are:
- You used the **full ENS name** instead of the **label only**.
- Your Merkle proof was generated for a different wallet.
- You are checking against the wrong Merkle root (wrong chain or deployment).

See **Merkle Proofs** and **Roles → Agent/Validator** for fixes.
