# Roles guide (non‑technical)

This page explains what each role can do, what you need first, common mistakes, and the typical workflow. All role checks are enforced **on‑chain**.

> ⚠️ **Subdomain label only**: When asked for a subdomain, use **only the label** (e.g., `helper`, **not** `helper.agent.agi.eth`). The contract derives the full name from a fixed root node + label.

---

## Employer

**What you can do (plain language)**
- Create a new job and fund escrow (`createJob`).
- Cancel a job **before** an agent is assigned (`cancelJob`).
- Dispute a job if things go wrong (`disputeJob`).
- Receive the job NFT on completion (minted automatically).
- List or delist your job NFT (`listNFT`, `delistNFT`), or buy other job NFTs (`purchaseNFT`).

**What you need first**
- A wallet with enough **AGI token** to fund the job payout.
- **Token approval** for the contract (required before `createJob`).
- The **correct network** + **official contract address**.

**Common mistakes**
- Skipping token approval (transaction reverts with `TransferFailed`).
- Using the wrong network or wrong contract address.
- Payout or duration outside allowed limits.
- Trying to cancel after an agent is assigned (invalid state).
- Forgetting to use a valid IPFS hash for job details.

**Typical workflow**
1. Approve the contract to spend your AGI tokens.
2. Create a job (provide IPFS hash, payout, duration).
3. Wait for an agent to apply.
4. If needed, dispute the job; otherwise, wait for validator approvals.
5. Receive the job NFT once completed.

---

## Agent

**What you can do (plain language)**
- Apply for a job (`applyForJob`).
- Submit a completion request with updated IPFS details (`requestJobCompletion`).
- Dispute a job if needed (`disputeJob`).
- Earn payout and reputation when a job is completed.

**What you need first**
- A wallet.
- **Eligibility** via any one of these (OR‑logic):
  - Added directly by the owner (`additionalAgents`), **or**
  - A valid **Merkle proof**, **or**
  - ENS ownership (NameWrapper `ownerOf`), **or**
  - ENS resolver `addr` match (fallback).
- **Subdomain label only** (e.g., `alice`, **not** `alice.agent.agi.eth`).

**Common mistakes**
- Using the **full ENS name** instead of the label only.
- Passing the wrong Merkle proof (or proof for another wallet).
- Trying to apply after an agent is already assigned.
- Requesting completion **after** the job duration expired.
- Applying while blacklisted.

**Typical workflow**
1. Confirm you’re eligible (allowlist, Merkle proof, or ENS ownership).
2. Apply for a job using your subdomain **label only**.
3. Deliver work off‑chain and update the IPFS hash.
4. Request completion.
5. If disputed, cooperate with moderators; otherwise, wait for validator approvals.

---

## Validator

**What you can do (plain language)**
- Approve jobs (`validateJob`) or disapprove jobs (`disapproveJob`).
- Earn a validator payout share and reputation when a job completes.

**What you need first**
- A wallet.
- **Eligibility** via any one of these (OR‑logic):
  - Added directly by the owner (`additionalValidators`), **or**
  - A valid **Merkle proof**, **or**
  - ENS ownership (NameWrapper `ownerOf`), **or**
  - ENS resolver `addr` match (fallback).
- **Subdomain label only** (e.g., `helper`, **not** `helper.club.agi.eth`).

**Common mistakes**
- Using the full ENS name instead of the label only.
- Validating/disapproving **twice** (invalid state).
- Trying to validate a job with no assigned agent.
- Acting while blacklisted.

**Typical workflow**
1. Confirm you’re eligible (allowlist, Merkle proof, or ENS ownership).
2. Check job details (IPFS hash + expected deliverables).
3. Approve or disapprove using your subdomain **label only** and proof (if required).
4. If approval threshold is met, job completes automatically.

---

## Moderator

**What you can do (plain language)**
- Resolve disputes (`resolveDispute`).

**What you need first**
- Your wallet must be added by the owner as a moderator.
- Understand the **canonical resolution strings**:
  - `agent win` → completes the job and pays the agent.
  - `employer win` → refunds the employer and closes the job.
  - Any other text only clears the dispute flag (no payout).

**Common mistakes**
- Using the wrong resolution string (no payout/refund happens).
- Trying to resolve a job that is not disputed.
- Attempting to resolve without being a moderator.

**Typical workflow**
1. Review evidence off‑chain.
2. Call `resolveDispute` with **exact** resolution text.
3. Confirm the dispute flag is cleared and payouts/refunds executed.

---

## Owner (operator)

**What you can do (plain language)**
- Pause/unpause the system (`pause`, `unpause`).
- Add/remove moderators (`addModerator`, `removeModerator`).
- Manage allowlists and blacklists (`addAdditionalAgent`, `addAdditionalValidator`, `blacklistAgent`, `blacklistValidator`).
- Adjust parameters (approvals, payouts, limits, metadata).
- Withdraw escrowed AGI tokens (`withdrawAGI`).
- Delist a job before assignment (`delistJob`).
- Add AGI types for payout bonuses (`addAGIType`).

**What you need first**
- Owner wallet (the deploying wallet or current owner).
- Operational policy for allowlists, disputes, and parameters.

**Common mistakes**
- Using a non‑owner wallet (fails with Ownable error).
- Updating parameters without communicating to users.
- Delisting a job after an agent is assigned (invalid state).

**Typical workflow**
1. Maintain allowlists, moderators, and blacklists.
2. Monitor disputes and job throughput.
3. Adjust parameters as needed.

---

## How roles interact (simple overview)
1. **Employer** creates and funds a job.
2. **Agent** applies and works on the job.
3. **Validator(s)** approve or disapprove the work.
4. If disputed, a **Moderator** resolves the dispute.
5. The job completes or is refunded; the **Employer** receives the job NFT.
