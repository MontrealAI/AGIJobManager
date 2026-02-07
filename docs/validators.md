# Validators (10‑minute workflow + incentives)

This guide is for **permissioned validators**. It is intentionally practical and ties
behavior to **on‑chain fields** like `jobSpecURI` and `jobCompletionURI`. For a longer,
step‑by‑step workflow, see [`validator-guide.md`](validator-guide.md). For deeper
incentive analysis, see [`game-theory.md`](game-theory.md).

## 1) Confirm eligibility (opt‑in club)
Validators are permissioned via allowlists, Merkle proofs, or ENS ownership. You
opt‑in **per job** by voting during `completionReviewPeriod`. If the job is disputed,
validator votes no longer advance settlement.

## 2) Gather evidence fast
Use the ENS job page (if present) or the on‑chain metadata URIs:
- **`jobSpecURI`**: what was promised.
- **`jobCompletionURI`**: what was delivered.

Metadata typically points to **IPFS CIDs** or other content‑addressed storage.
Verify that the URIs resolve and the evidence is complete.

## 3) 10‑minute checklist (template)
1. Deliverables match the spec (scope + acceptance criteria).
2. Links open and files are accessible.
3. Hashes/CIDs match any referenced artifacts.
4. Deviations are documented and acceptable.
5. Your pass/fail notes are concise and reproducible.

## 4) Decide: approve, disapprove, abstain, or escalate
- **Approve** when evidence clearly meets the spec.
- **Disapprove** when evidence clearly fails the spec.
- **Abstain** when evidence is missing, access is blocked, or the spec is ambiguous.
- **Escalate** to moderators/operators when ambiguity is systemic (e.g., missing
  acceptance criteria) so they can decide whether to dispute.

## 5) Vote within the window
- Voting must happen **before `completionReviewPeriod` ends**.
- **Dispute thresholds** freeze validator voting; once disputed, validators no longer
  affect settlement.
- If **no votes** are cast before the review window ends, the job can finalize via
  the **no‑vote liveness** rule (agent wins without reputation).

## 6) Bonds, rewards, and slashing (conceptual)
- **Validator bond** is posted per vote (`validatorBondBps`, with min/max caps).
- **Correct vote**: bond returned + share of validator reward pool.
- **Incorrect vote**: bond partially slashed (`validatorSlashBps`).
- **No vote**: no bond risk, but also no validator rewards.

## 7) Evidence expectations (minimum)
- Job completion metadata that maps each deliverable to the spec.
- A manifest (hashes/CIDs) or reproducible steps to verify artifacts.
- A short summary of any deviations and why they are acceptable or unacceptable.

## 8) When to abstain (and why it matters)
Abstention is rational when evidence is incomplete or ambiguous, but it reduces
validator rewards and can create low‑participation outcomes. If you abstain:
- Provide a short reason to the operator.
- Flag the job for dispute triage if the ambiguity cannot be resolved quickly.
