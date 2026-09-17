# Validator Guide — v0.9.5

Validators review submitted work and vote once per job. Rewards and bonds use native USDC; signing transactions requires ETH for gas.

## Before voting

AGI Validators normally require membership under `club.agi.eth` or `alpha.club.agi.eth`. The connected wallet must satisfy qualifying NameWrapper ownership/approval or resolver-address fallback; use only the label, such as `alice`. The contract preserves `additionalValidators` and valid validator Merkle proofs as explicit owner-managed membership exceptions. They are not proof of ENS membership. You must not be blacklisted. Agent namespace membership and optional job-page ENS ownership do not by themselves authorize validator votes.

Review the job specification and completion evidence. Confirm that completion has been requested, the job is unsettled and undisputed, and the completion review window has not ended. Read and approve the required USDC bond. The first vote fixes that job's per-validator bond for all subsequent votes, even if the owner later changes bond settings. The bond never exceeds the job cost.

## Cast one vote

- Approve work: `validateJob(jobId, subdomain, proof)`.
- Reject work: `disapproveJob(jobId, subdomain, proof)`.

Each successful call posts its USDC bond and emits `JobValidated` or `JobDisapproved`. You cannot change, repeat, or cast both kinds of vote. At most 50 validators can vote on one job.

A reached approval threshold starts a challenge window; it does not automatically settle or pay anyone. A reached disapproval threshold opens a dispute. Anyone can later call `finalizeJob` when its timing and vote conditions allow. See the [walkthrough](../user-guide/happy-path.md).

## Rewards and slashing

Correct-side validators share the job's recorded reward budget plus any pool assigned by the bond rules, and receive their original bond back. Incorrect-side validators recover only the unslashed portion of their bond. “Correct” means matching the contract's final outcome: approvals on agent success, disapprovals on employer win.

The validator budget defaults to 8% of the original job cost and is fixed at posting. The owner can set 1–60% for future jobs. On success, validators are paid first; the contract then pays 30% and 10% of the original cost to the configured wallets and sends the remainder to the agent. Integer division can leave a small reward remainder; it goes to the agent on success or the employer on refund. Bond pools are separate from the cost percentages.

The default slash is 80% of an incorrect vote's bond; read `validatorSlashBps` for the deployment's actual setting. Correct-side reputation can increase on qualifying settlement. If nobody votes, finalization opens a dispute without payment. Neutral timeout returns each bond without reward or penalty.

Common errors: `NotAuthorized`, `Blacklisted`, `InvalidState` (including duplicate/late votes), `ValidatorLimitReached`, and `TransferFailed`. See [common reverts](../user-guide/common-reverts.md).

## Independence and refund rewards

You cannot review a job where you are the buyer or assigned agent, including through their ENS controller. A credential or recorded controller can contribute only one vote per job, even using different operators or names. You and your recorded controller cannot arbitrate a job you reviewed. Separate wallets are not proof of separate people.

On a buyer win, the full escrow returns to the buyer. The base reviewer reward is capped by forfeited agent collateral and can be below the posted reward budget; incorrect-validator slashes supplement it. A neutral arbitration timeout returns your bond without reward or penalty. A blocked payout remains a reserved claim for your original wallet.
