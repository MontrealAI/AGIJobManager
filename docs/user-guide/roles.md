# Roles guide (non-technical)

This guide explains what each role can do, what you need before starting, and common mistakes.

> **Reminder: use the label only** for ENS identity checks.
> - ✅ `helper` (label)
> - ❌ `helper.agent.agi.eth`
> The contract derives the namehash from a fixed root node + label.

## Employer

### What you can do
- Create a job with escrowed payout (`createJob`).
- Cancel a job **before** an agent is assigned (`cancelJob`).
- Dispute a job while it is in progress (`disputeJob`).
- Receive the job NFT when the job completes (minted automatically).
- List and sell the job NFT on the built‑in marketplace (`listNFT`, `delistNFT`).

### What you need first
- A wallet with enough **AGI token** balance for the job payout.
- ERC‑20 **approval** for the contract to pull the payout from your wallet.
- Correct **contract address** and **network**.

### Common mistakes
- Forgetting to approve the token transfer before creating a job.
- Using the wrong network or outdated contract address.
- Trying to cancel after an agent is assigned (not allowed).

### Typical workflow
1. Approve token spend.
2. Create a job (job spec metadata URI, payout, duration).
3. Wait for an agent to apply.
4. If needed, dispute the job.
5. Receive the job NFT on completion.

---

## Agent

### What you can do
- Apply for an open job (`applyForJob`).
- Request job completion (`requestJobCompletion`).
- Earn payout and reputation if the job completes.

### What you need first
- A wallet **eligible** as an agent via **any** of:
  - Explicit allowlist (`additionalAgents`).
  - Merkle proof (allowlist).
  - ENS NameWrapper ownership.
  - ENS resolver.addr fallback.
- The **subdomain label only** (not the full ENS name).
- Optional: a Merkle proof if you’re allowlisted.

### Common mistakes
- Entering the full ENS name instead of the label.
- Using a proof from a different allowlist or chain.
- Applying for a job that is already assigned.
- Requesting completion after the job duration expired.

### Typical workflow
1. Confirm eligibility (allowlist/Merkle/ENS).
2. Apply for an open job.
3. Deliver work off‑chain.
4. Request completion with the completion metadata URI.

---

## Validator

### What you can do
- Validate a job (approve or disapprove) (`validateJob`, `disapproveJob`).
- Earn payout share and reputation when jobs complete.

### What you need first
- A wallet **eligible** as a validator via **any** of:
  - Explicit allowlist (`additionalValidators`).
  - Merkle proof (allowlist).
  - ENS NameWrapper ownership.
  - ENS resolver.addr fallback.
- The **subdomain label only** (not the full ENS name).
- Optional: a Merkle proof if you’re allowlisted.

### Common mistakes
- Trying to validate the same job twice.
- Entering the full ENS name instead of the label.
- Attempting to validate a job before it has an assigned agent.

### Typical workflow
1. Confirm eligibility (allowlist/Merkle/ENS).
2. Review job status and details.
3. Approve or disapprove.

---

## Moderator

### What you can do
- Resolve disputes (`resolveDisputeWithCode`).
  - **Resolution codes**:
    - `NO_ACTION (0)` → log only; dispute remains active.
    - `AGENT_WIN (1)` → pays agent and completes job.
    - `EMPLOYER_WIN (2)` → refunds employer and closes job.
  - The reason string is freeform and does not control settlement.

### What you need first
- A wallet that is listed as a moderator (`addModerator` by the owner).
- Correct contract address and network.

### Common mistakes
- Using the deprecated `resolveDispute` with a non‑canonical string instead of selecting a typed action code.
- Trying to resolve a dispute that is not actually marked as disputed.

### Typical workflow
1. Confirm the job is in dispute.
2. Decide outcome off‑chain.
3. Resolve with the correct canonical string.

---

## Owner

### What you can do
- Pause/unpause contract (`pause`, `unpause`).
- Manage moderators and allowlists (`addModerator`, `addAdditionalAgent/Validator`).
- Blacklist/un‑blacklist agents or validators.
- Update parameters (limits, reward percentage, metadata fields).
- Withdraw surplus AGI tokens (`withdrawAGI`, limited to `withdrawableAGI()`).
- Delist jobs before assignment (`delistJob`).
- Manage AGI Types for agent payout bonuses (`addAGIType`).

### What you need first
- The owner wallet configured at deployment.
- Strong operational security (owner actions are highly privileged).

### Common mistakes
- Pausing during critical workflows and forgetting to unpause.
- Misconfiguring payout limits or validator thresholds.
- Using the wrong network when changing parameters.

### Typical workflow
1. Monitor operations.
2. Adjust allowlists and parameters as needed.
3. Resolve operational incidents (pause/unpause, blacklist).

---

## How roles interact (simple overview)

- **Employer** creates and funds a job.
- **Agent** applies, performs work, and requests completion.
- **Validators** approve or disapprove the job outcome.
- **Moderator** resolves disputes (if any).
- **Owner** manages safety, parameters, and allowlists.

For the full lifecycle, see the [Happy path walkthrough](happy-path.md).
