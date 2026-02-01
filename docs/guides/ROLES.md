# Roles (non‑technical overview)

This guide explains each role in plain language. Use it as a quick “what can I do / what do I need” reference before you use the UI.

## Employer

**What you can do**
- Create a job and fund it in escrow.
- Monitor applications, validations, and disputes.
- Cancel a job before it is assigned.
- Dispute a job if something goes wrong.
- Receive the job NFT after completion.

**What you need**
- A wallet with enough AGI tokens to fund the job payout.
- The correct network (usually Ethereum mainnet).
- The correct contract address (set in the UI).

**What you should NOT do**
- Do **not** try to cancel after an agent has been assigned.
- Do **not** assume you can resolve disputes (only moderators can).
- Do **not** create a job with payout or duration of `0`.

**Happy path checklist**
- [ ] Connect wallet and set the contract address.
- [ ] Check **AGI Token balance** and **AGI allowance** in “Your role flags”.
- [ ] Use **Approve AGI token** to set allowance (if needed).
- [ ] Use **Create job** with a **job spec metadata URI**, payout, duration, and details.
- [ ] Generate `jobSpec.v1.json`, upload it to IPFS, and paste the resulting URI (advanced users can paste an existing URI).
- [ ] Wait for an agent to apply and validators to approve.
- [ ] If needed, use **Dispute job (employer)**.

---

## Agent

**What you can do**
- Apply for an open job.
- Request completion when work is done.
- Dispute a job if necessary.
- Earn payout and reputation on completion.

**What you need**
- A wallet that is **eligible** as an agent (allowlist, Merkle proof, or ENS name).
- A **label only** (subdomain) for your identity (example: `helper`, not a full ENS name).
- A Merkle proof **if** you are not in the additional allowlist and do not own the ENS subdomain.

**What you should NOT do**
- Do **not** apply for jobs if you are blacklisted.
- Do **not** request completion unless you are the assigned agent.
- Do **not** reuse the same job application from another wallet.

**Happy path checklist**
- [ ] Connect wallet and set the contract address.
- [ ] Run **Identity checks (preflight only)** with your label and proof.
- [ ] Use **Apply for job** with your label and proof.
- [ ] Deliver work and generate `jobCompletion.v1.json` with your deliverables.
- [ ] Upload the completion metadata to IPFS and paste the resulting URI.

---

## Validator (Club)

**What you can do**
- Validate (approve) a job.
- Disapprove a job to trigger a dispute when enough disapprovals occur.
- Earn reputation and a share of validation rewards.

**What you need**
- A wallet that is **eligible** as a validator (allowlist, Merkle proof, or ENS name).
- A **label only** (subdomain) for your validator identity.
- A Merkle proof **if** you are not in the additional allowlist and do not own the ENS subdomain.

**What you should NOT do**
- Do **not** validate and disapprove the **same job** from the same wallet.
- Do **not** validate jobs that are already completed.
- Do **not** attempt validation if you are blacklisted.

**Happy path checklist**
- [ ] Connect wallet and set the contract address.
- [ ] Run **Identity checks (preflight only)** with your label and proof.
- [ ] Use **Validate job** to approve an in‑progress job.
- [ ] If the work is invalid, use **Disapprove job** instead.

---

## Moderator

**What you can do**
- Resolve disputes with a typed action code and freeform reason.
- Trigger on-chain settlement for `AGENT_WIN` or `EMPLOYER_WIN`.

**What you need**
- A wallet that the contract owner has set as a **moderator**.
- The correct resolution action code.

**What you should NOT do**
- Do **not** use the deprecated `resolveDispute` string interface for settlement.
- Do **not** attempt dispute resolution if you are not a moderator.

**Happy path checklist**
- [ ] Connect wallet and confirm **Moderator: true** in “Your role flags”.
- [ ] Enter the **Job ID**, select a resolution action, and add an optional reason.
- [ ] Click **Resolve dispute** and confirm the transaction.

---

## Owner (Admin)

**What you can do**
- Pause/unpause the contract.
- Add/remove moderators.
- Manage allowlists/blacklists.
- Update protocol parameters.
- Withdraw escrowed AGI tokens.

**What you need**
- The wallet that is the contract **owner**.
- Operational procedures for risk management and access control.

**What you should NOT do**
- Do **not** use owner actions on the wrong network.
- Do **not** update parameters without reviewing impacts on users.
- Do **not** expose owner keys in browser wallets used for day‑to‑day work.

**Happy path checklist**
- [ ] Connect with the owner wallet.
- [ ] Open **Admin / Owner** and confirm **Owner status**.
- [ ] Perform one action at a time (pause, moderators, blacklists, parameters).
- [ ] Refresh **Contract snapshot** after changes.
