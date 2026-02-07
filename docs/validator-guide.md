# Validator guide (15‑minute workflow)

This short guide helps permissioned validators review and vote on a job.

## 1) Confirm you are eligible
Validators must be allowlisted or hold a valid ENS identity per the platform’s rules. If you are unsure, ask the operator for your allowlist status or ENS namespace.

## 2) Gather the evidence
Use the job’s ENS page (if available) or the on‑chain `jobSpecURI` and `jobCompletionURI`:
- **Spec JSON**: what was promised.
- **Completion JSON**: what was delivered.
- **Manifest/integrity**: hashes or CIDs for artifacts.

## 3) Review with a checklist
A simple checklist can be:
- Deliverables match the spec.
- Links open and are verifiable.
- Integrity hashes match the files provided.
- No missing or substituted files.

## 4) Vote within the review window
- Vote **approve** if the completion meets the spec.
- Vote **disapprove** if it does not.
- Voting requires a **validator bond**; the bond is returned or slashed based on outcome.

## 5) After you vote
- If approvals reach the threshold, a short **challenge period** applies before settlement.
- If disapprovals reach the threshold, the job enters **dispute**.
- If the review window ends with no votes, the job settles automatically (no‑vote liveness rule).

## Quick tips
- Never vote without reading both the spec and completion.
- If a private artifact is referenced, confirm access or request a redacted public receipt.
- Keep notes; they help in dispute resolution.
