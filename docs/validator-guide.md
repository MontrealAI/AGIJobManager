# Validator guide (10‑minute workflow)

This short guide helps permissioned validators review and vote on a job. It is intentionally practical and maps directly to on‑chain fields like `jobSpecURI` and `jobCompletionURI`. For incentive context, see [`game-theory.md`](game-theory.md).

## 1) Confirm you are eligible
Validators must be allowlisted **or** hold a valid ENS identity in the platform’s validator namespace (the “ENS club”). If you are unsure, ask the operator for your allowlist status or ENS namespace.

## 2) Gather the evidence
Use the job’s ENS page (if available) or the on‑chain `jobSpecURI` and `jobCompletionURI` (see [`job-metadata.md`](job-metadata.md) and [`ens-job-pages.md`](ens-job-pages.md)):
- **Spec JSON**: what was promised.
- **Completion JSON**: what was delivered.
- **Manifest/integrity**: hashes or CIDs for artifacts.

## 3) Review with a checklist
A simple checklist template:
- Deliverables match the spec.
- Links open and are verifiable.
- Integrity hashes match the files provided.
- No missing or substituted files.
- Clear pass/fail notes for each deliverable.

## 4) Decide: vote, abstain, or escalate
- **Vote approve** when the completion clearly meets the spec.
- **Vote disapprove** when the completion clearly fails the spec.
- **Abstain / escalate** when evidence is missing, access is blocked, or the spec is ambiguous. Document the gap and alert the operator/moderator so the job can be disputed or clarified.

## 5) Vote within the review window
- Voting requires a **validator bond**; it is **returned if you vote with the final outcome** and **partially slashed** if you are on the losing side (see `validatorSlashBps` in the contract docs).
- If no validators vote before the review window ends, the job can still settle via the **no‑vote liveness** rule (agent wins without reputation).

## 6) After you vote
- If approvals reach the threshold, a short **challenge period** applies before settlement.
- If disapprovals reach the threshold, the job enters **dispute**.
- If the review window ends with no votes, the job settles automatically (no‑vote liveness rule).

## 7) Evidence expectations (minimum)
- A completion JSON that maps to the spec’s deliverables.
- A manifest (hashes/CIDs) or reproducible steps to verify artifacts.
- A short note on any deviations and why they are acceptable.

## Quick tips
- Never vote without reading both the spec and completion.
- If a private artifact is referenced, confirm access or request a redacted public receipt.
- Keep notes; they help in dispute resolution.
