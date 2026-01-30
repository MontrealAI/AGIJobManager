# Roles: Who does what (non-technical overview)

This guide is written for non‑technical users who can operate a wallet but do not want to learn smart‑contract internals. It summarizes each role, what you can do, what you need, and a short “happy path” checklist. For step‑by‑step instructions, see the [Happy Path Walkthrough](HAPPY_PATH.md).

---

## Employer

**What you can do**
- Create a job and fund it from your wallet.
- Monitor validator approvals/disapprovals.
- Dispute a job before it is completed.
- Receive the job NFT when completed.

**What you need**
- A wallet funded with the job token and gas.
- The correct network and contract address.
- Enough token allowance approved for the job payout.

**What you should NOT do (common mistakes)**
- Do **not** create a job without approving the token allowance first.
- Do **not** try to cancel after an agent is assigned.
- Do **not** dispute after the job is completed.

**Happy path checklist**
- [ ] Connect wallet → confirm network and contract address.
- [ ] Approve token allowance for the payout.
- [ ] Create job (IPFS hash, payout, duration, details).
- [ ] Wait for an agent to apply.
- [ ] Track validator approvals.
- [ ] If needed, dispute before completion.

---

## Agent

**What you can do**
- Apply to an open job (if you pass identity checks).
- Submit a completion request with the final IPFS hash.
- Earn payout and reputation when the job is completed.

**What you need**
- A wallet that passes the agent identity gate (allowlist, Merkle proof, or ENS label ownership).
- The correct network and contract address.
- A valid “label‑only” input (just the subdomain label).

**What you should NOT do (common mistakes)**
- Do **not** apply without a valid label or Merkle proof.
- Do **not** request completion after the job duration has expired.
- Do **not** request completion for a job you are not assigned to.

**Happy path checklist**
- [ ] Confirm your agent eligibility (allowlist / Merkle / ENS label).
- [ ] Apply for the job with the label only.
- [ ] Deliver work off‑chain.
- [ ] Request completion with the final IPFS hash.
- [ ] Wait for validator approval and payout.

---

## Validator (club)

**What you can do**
- Validate or disapprove jobs (but not both for the same job).
- Earn a portion of the job payout and reputation.

**What you need**
- A wallet that passes the validator identity gate (allowlist, Merkle proof, or ENS label ownership).
- The correct network and contract address.
- A valid “label‑only” input (just the subdomain label).

**What you should NOT do (common mistakes)**
- Do **not** validate and disapprove the same job (the contract forbids it).
- Do **not** validate after the job is completed.
- Do **not** validate if you are blacklisted.

**Happy path checklist**
- [ ] Confirm validator eligibility (allowlist / Merkle / ENS label).
- [ ] Validate the job (or disapprove if required).
- [ ] Wait for the approval/disapproval threshold outcome.

---

## Moderator

**What you can do**
- Resolve disputes with a resolution string.

**What you need**
- Your wallet must be added as a moderator by the owner.
- The correct network and contract address.

**What you should NOT do (common mistakes)**
- Do **not** attempt dispute resolution unless the job is in dispute.
- Do **not** use a non‑canonical resolution string unless you intend to return the job to its prior state.

**Happy path checklist**
- [ ] Confirm you are a moderator.
- [ ] Open the disputed job ID.
- [ ] Use the correct resolution string (“agent win”, “employer win”, or other).
- [ ] Confirm resolution outcome in the UI.

---

## Owner (admin)

**What you can do**
- Pause/unpause the contract.
- Manage moderators and allowlists/blacklists.
- Update key parameters (approvals, disapprovals, reward percentages, limits).
- Withdraw escrowed tokens (owner‑only).

**What you need**
- The owner wallet (the only wallet allowed to execute admin actions).
- The correct network and contract address.

**What you should NOT do (common mistakes)**
- Do **not** change parameters on the wrong network.
- Do **not** set invalid values (e.g., zero approvals, zero limits).
- Do **not** remove a moderator before resolving an active dispute.

**Happy path checklist**
- [ ] Confirm the owner wallet and network.
- [ ] Manage allowlists/blacklists and moderators.
- [ ] Update parameters only when necessary.
- [ ] Monitor activity and ensure jobs flow smoothly.
