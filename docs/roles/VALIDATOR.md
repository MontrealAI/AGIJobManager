# Validator Guide

Validators approve or disapprove work and are rewarded for correct participation.

## Identity gating (must pass at least one)
You must satisfy **one** of these:
1. **ENS/NameWrapper ownership** of your subdomain under the club root.
2. **Merkle allowlist** proof.
3. **additionalValidators** allowlist (owner‑managed).

## Step‑by‑step (non‑technical)
> **Screenshot placeholder:** Etherscan “Write Contract” tab showing `validateJob` inputs filled in.
### 1) Validate a job
Call `validateJob(jobId, subdomain, proof)`.

**On‑chain results**
- Event: `JobValidated`
- State: validator approval count increments
- Bond: the contract transfers the required bond from your wallet (ensure allowance)

### 2) Disapprove a job (if needed)
Call `disapproveJob(jobId, subdomain, proof)`.

**On‑chain results**
- Event: `JobDisapproved`
- State: validator disapproval count increments
- If disapprovals reach the threshold, the job becomes disputed.
- Bond: the same per‑job bond is posted for disapprovals.

## Vote rules (strict)
- A validator **cannot vote twice**.
- A validator **cannot both approve and disapprove** a single job.

## Rewards
When a job completes:
- Validators whose vote matches the final outcome split the reward pool and any slashed bonds.
- Validators who vote against the final outcome recover only the un‑slashed portion of their bond.
- Correct‑side validators gain reputation points.

## Common mistakes
- Voting twice → `InvalidState`
- Not authorized (identity gate) → `NotAuthorized`
- Blacklisted → `Blacklisted`

## For developers
### Key functions
- `validateJob`
- `disapproveJob`

### Events to index
`JobValidated`, `JobDisapproved`, `JobCompleted`, `ReputationUpdated`, `JobDisputed`
