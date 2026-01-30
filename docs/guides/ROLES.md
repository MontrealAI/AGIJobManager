# Roles (non‑technical guide)

This guide explains **who can do what**, what you need before you start, and the most common mistakes for each role. It is written for non‑technical users using the web UI, Etherscan, or a wallet.

> **Identity note (subdomain label only)**: Whenever the UI or a function asks for a **label** or **subdomain**, you must enter **only the label**, not the full ENS name. Example: use `helper` **NOT** `helper.agent.agi.eth`. The contract combines the label with a fixed root node on-chain, so the full name will hash incorrectly and fail identity checks.

## Employer

**What you can do (contract actions)**
- Create a job and fund escrow (`createJob`).
- Cancel a job **before** an agent is assigned (`cancelJob`).
- Dispute a job if something goes wrong (`disputeJob`).
- Receive the job NFT after completion (minted in `_completeJob`).

**What you need first**
- A wallet with enough AGI tokens for the payout.
- Token **approval** for the contract to pull the payout (ERC‑20 `approve`).
- The correct network and contract address.

**Common mistakes**
- Cancelling **after** an agent is assigned (reverts with `InvalidState`).
- Creating a job with payout or duration of `0` (reverts with `InvalidParameters`).
- Using the wrong network or contract address (transaction fails or points to the wrong token).

**Typical workflow**
1. Approve token spend for the payout.
2. Create a job with IPFS hash, payout, duration, and details.
3. Wait for an agent to apply and validators to approve.
4. If needed, open a dispute and wait for a moderator resolution.

---

## Agent

**What you can do (contract actions)**
- Apply for an open job (`applyForJob`).
- Request completion when work is done (`requestJobCompletion`).
- Dispute a job if necessary (`disputeJob`).
- Receive payout and reputation when a job completes.

**What you need first**
- A wallet that is **eligible** as an agent (one of the identity checks below must pass).
- **Label only** for your agent identity (example: `helper`, **NOT** `helper.agent.agi.eth`).
- If you are **not** on the additional allowlist, you need **one** of:
  - A valid **Merkle proof** for your wallet, **or**
  - Ownership of the ENS subdomain via **NameWrapper**, **or**
  - An ENS resolver whose `addr()` points to your wallet.

**Common mistakes**
- Using the **full ENS name** instead of the label (identity check fails).
- Applying when you are blacklisted (`Blacklisted`).
- Requesting completion from a wallet that is **not** the assigned agent (`NotAuthorized`).
- Requesting completion after the job duration has expired (`InvalidState`).

**Typical workflow**
1. Run the identity preflight check in the UI with **label only** and (if needed) your proof.
2. Apply for a job.
3. Deliver work and upload the completion output to IPFS.
4. Request completion with the new IPFS hash.

---

## Validator

**What you can do (contract actions)**
- Approve a job (`validateJob`).
- Disapprove a job to raise a dispute if enough disapprovals occur (`disapproveJob`).
- Earn validator reward share and reputation on completion.

**What you need first**
- A wallet that is **eligible** as a validator (one of the identity checks below must pass).
- **Label only** for your validator identity (example: `validator`, **NOT** `validator.club.agi.eth`).
- If you are **not** on the additional allowlist, you need **one** of:
  - A valid **Merkle proof** for your wallet, **or**
  - Ownership of the ENS subdomain via **NameWrapper**, **or**
  - An ENS resolver whose `addr()` points to your wallet.

**Common mistakes**
- Using the full ENS name instead of the label (identity check fails).
- Validating or disapproving the **same job twice** from the same wallet (`InvalidState`).
- Validating a job that is already completed (`InvalidState`).
- Attempting to validate while blacklisted (`Blacklisted`).

**Typical workflow**
1. Run the identity preflight check with **label only** and (if needed) your proof.
2. Validate **or** disapprove (not both) for a job in progress.
3. Wait for approvals/disapprovals to reach thresholds.

---

## Moderator

**What you can do (contract actions)**
- Resolve disputes with a resolution string (`resolveDispute`).
- Settle funds using the canonical resolution strings:
  - `"agent win"`
  - `"employer win"`

**What you need first**
- A wallet that the **owner** has registered as a moderator.
- The correct resolution string for settlement (see above).

**Common mistakes**
- Using a non‑canonical resolution string (clears dispute but **does not** settle funds).
- Attempting to resolve disputes with a non‑moderator wallet (`NotModerator`).

**Typical workflow**
1. Confirm moderator status in the UI.
2. Enter the job ID and the resolution string (or use UI buttons).
3. Resolve the dispute and verify job status.

---

## Owner (admin)

**What you can do (contract actions)**
- Pause/unpause the contract (`pause`, `unpause`).
- Manage moderators and allowlists/blacklists (`addModerator`, `addAdditionalAgent`, `blacklistAgent`, etc.).
- Update parameters (validator thresholds, payout limits, roots, etc.).
- Withdraw escrowed AGI tokens (`withdrawAGI`).
- Delist a job before assignment (`delistJob`).

**What you need first**
- The wallet address that owns the contract.
- Operational procedures for key management and approvals.

**Common mistakes**
- Using owner functions on the wrong network or contract.
- Updating parameters without communicating changes to users.
- Using a hot wallet for privileged actions.

**Typical workflow**
1. Connect with the owner wallet and confirm **Owner** in the UI.
2. Perform one admin action at a time.
3. Refresh the contract snapshot and communicate changes.

---

## How roles interact (simple view)

1. **Employer** creates a funded job.
2. **Agent** applies and delivers work.
3. **Validators** approve or disapprove.
4. **Moderator** resolves disputes if needed.
5. **Owner** oversees parameters and allowlists.

For a full walkthrough, see the **Happy Path** guide.
