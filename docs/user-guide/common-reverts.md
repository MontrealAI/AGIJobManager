# Common revert reasons (and fixes)

This guide maps what you tried to do → what you saw → how to fix it. All items below are derived directly from the contract logic and custom errors.

> **Tip:** If you see a generic “execution reverted” error, scroll the error details to find the **custom error** name (e.g., `NotAuthorized`, `InvalidState`).

## Quick troubleshooting checklist

- ✅ Correct **network** and **contract address**
- ✅ Correct **token address** via `agiToken()`
- ✅ Sufficient **token balance** and **allowance**
- ✅ Correct **role** (employer vs agent vs validator)
- ✅ Correct **job state** (created/assigned/completed/disputed)
- ✅ **Label‑only** ENS input (`helper`, not `helper.agent.agi.eth`)

## Revert reasons table

| What you tried to do | What you saw | What it means | How to fix it | Where to learn more |
| --- | --- | --- | --- | --- |
| Apply for a job | `NotAuthorized` | Your wallet did not pass the agent eligibility checks. | Make sure **one** of the following is true: (1) you’re in `additionalAgents`, (2) you provided a valid Merkle proof, (3) you own the ENS NameWrapper subdomain, or (4) your ENS resolver.addr points to your wallet. Also **use the label only**. | [Roles → Agent](roles.md#agent), [Merkle proofs](merkle-proofs.md) |
| Apply for a job | `IneligibleAgentPayout` | Your agent payout tier is 0%, so the job cannot be accepted. | Hold an eligible AGI‑type NFT with a nonzero payout tier before applying. | [Roles → Agent](roles.md#agent) |
| Apply for a job | `InvalidState` | Job already has an assigned agent. | Pick another open job. | [Happy path](happy-path.md) |
| Apply for a job | `Blacklisted` | Your wallet is blacklisted as an agent. | Contact the operator/owner for remediation. | [Roles → Agent](roles.md#agent) |
| Request job completion | `NotAuthorized` | Only the assigned agent can request completion. | Ensure you are the assigned agent for that job. | [Roles → Agent](roles.md#agent) |
| Request job completion | `InvalidState` | The job has expired or is in an invalid state. | Check `assignedAt + duration` and request completion before expiration. | [Happy path](happy-path.md) |
| Validate or disapprove a job | `NotAuthorized` | Your wallet did not pass the validator eligibility checks. | Make sure **one** of the following is true: (1) you’re in `additionalValidators`, (2) you provided a valid Merkle proof, (3) you own the ENS NameWrapper subdomain, or (4) your ENS resolver.addr points to your wallet. Also **use the label only**. | [Roles → Validator](roles.md#validator), [Merkle proofs](merkle-proofs.md) |
| Validate or disapprove a job | `InvalidState` | The job has no assigned agent, is already completed, or you already voted. | Validate only after assignment, and only once per job. | [Happy path](happy-path.md) |
| Validate or disapprove a job | `Blacklisted` | Your wallet is blacklisted as a validator. | Contact the operator/owner for remediation. | [Roles → Validator](roles.md#validator) |
| Dispute a job | `NotAuthorized` | Only the employer or assigned agent can dispute. | Ensure you are the employer or assigned agent for that job. | [Roles → Employer](roles.md#employer) |
| Dispute a job | `InvalidState` | Job is already completed or already disputed. | Dispute only while the job is in progress. | [Happy path](happy-path.md) |
| Resolve a dispute | `NotModerator` | Only moderators can resolve disputes. | Ask the owner to add your wallet as a moderator. | [Roles → Moderator](roles.md#moderator) |
| Resolve a dispute | `InvalidState` | The job is not currently disputed. | Confirm the job is in dispute before resolving. | [Happy path](happy-path.md) |
| Cancel a job | `NotAuthorized` | Only the employer can cancel. | Use the employer wallet that created the job. | [Roles → Employer](roles.md#employer) |
| Cancel or delist a job | `InvalidState` | The job is completed or already assigned. | Only cancel/delist while the job is still unassigned. | [Happy path](happy-path.md) |
| List an NFT | `NotAuthorized` | You are not the NFT owner. | Only the NFT owner can list it. | [Roles → Employer](roles.md#employer) |
| List an NFT | `InvalidParameters` | Listing price is zero. | Set a non‑zero price. | [Roles → Employer](roles.md#employer) |
| Purchase an NFT | `InvalidState` | Listing is inactive or already purchased. | Refresh listing state; buy only active listings. | [Happy path](happy-path.md) |
| Delist an NFT | `NotAuthorized` | You are not the seller or listing is inactive. | Only the listing seller can delist. | [Roles → Employer](roles.md#employer) |
| Create a job | `InvalidParameters` | Payout/duration is zero or above contract limits. | Use a positive payout and duration within limits (`maxJobPayout`, `jobDurationLimit`). | [Happy path](happy-path.md) |
| Withdraw AGI (owner) | `InvalidParameters` | Amount is zero or exceeds contract balance. | Withdraw an amount within the contract’s AGI balance. | [Roles → Owner](roles.md#owner) |
| Contribute to reward pool | `InvalidParameters` | Amount is zero. | Enter a positive amount. | [Happy path](happy-path.md) |
| Add AGI type (owner) | `InvalidParameters` | Address is zero or payout percentage outside 1–100. | Provide a valid NFT address and percentage. | [Roles → Owner](roles.md#owner) |
| Any token transfer | `TransferFailed` | Token transfer or transferFrom returned false. | Ensure you have enough AGI balance and **approved** the contract for the needed amount. | [Happy path](happy-path.md) |
| Any job action | `JobNotFound` | The job ID does not exist. | Double‑check the job ID. | [Happy path](happy-path.md) |
| Set validation reward percentage (owner) | `InvalidParameters` | Percentage must be between 1 and 100. | Use a value from 1–100. | [Roles → Owner](roles.md#owner) |
| Actions protected by pause | `Pausable: paused` | The contract is paused, so `whenNotPaused` actions are blocked. | Wait for the owner to unpause before retrying. | [Roles → Owner](roles.md#owner) |

## If you still can’t proceed

1. Confirm the **contract address** and **network**.
2. Check the **job state** and your **role**.
3. Verify allowance and balance.
4. Review the [Merkle proof guide](merkle-proofs.md) if identity gating is involved.
