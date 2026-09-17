# Validator Guide — v0.9.2

Validators review submitted work and vote once per job. Rewards and bonds use native USDC; signing transactions requires ETH for gas.

## Before voting

Pass a configured validator identity route: `additionalValidators`, a valid validator Merkle proof, or the configured club ENS route. The ENS route supports qualifying NameWrapper ownership/approval and resolver-address fallback. Use the label only. You must not be blacklisted.

Review the job specification and completion evidence. Confirm that completion has been requested, the job is unsettled and undisputed, and the completion review window has not ended. Read and approve the required USDC bond. The first vote fixes that job's per-validator bond for all subsequent votes, even if the owner later changes bond settings. The bond never exceeds the job cost.

## Cast one vote

- Approve work: `validateJob(jobId, subdomain, proof)`.
- Reject work: `disapproveJob(jobId, subdomain, proof)`.

Each successful call posts its USDC bond and emits `JobValidated` or `JobDisapproved`. You cannot change, repeat, or cast both kinds of vote. At most 50 validators can vote on one job.

A reached approval threshold starts a challenge window; it does not automatically settle or pay anyone. A reached disapproval threshold opens a dispute. Anyone can later call `finalizeJob` when its timing and vote conditions allow. See the [walkthrough](../user-guide/happy-path.md).

## Rewards and slashing

Correct-side validators share the job's recorded reward budget plus any pool assigned by the bond rules, and receive their original bond back. Incorrect-side validators recover only the unslashed portion of their bond. “Correct” means matching the contract's final outcome: approvals on agent success, disapprovals on employer win.

The validator budget defaults to 8% of the original job cost and is fixed at posting. The owner can set 1–60% for future jobs. On success, validators are paid first; the contract then pays 30% and 10% of the original cost to the configured wallets and sends the remainder to the agent. Integer division can leave a small reward remainder; it goes to the agent on success or the employer on refund. Bond pools are separate from the cost percentages.

The default slash is 80% of an incorrect vote's bond; read `validatorSlashBps` for the deployment's actual setting. Correct-side reputation can increase on qualifying settlement. If nobody votes, there are no validator rewards and no-vote completion earns no reputation.

Common errors: `NotAuthorized`, `Blacklisted`, `InvalidState` (including duplicate/late votes), `ValidatorLimitReached`, and `TransferFailed`. See [common reverts](../user-guide/common-reverts.md).
