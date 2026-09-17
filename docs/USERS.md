# AGIJobManager v0.9.3 — User Guide

AGIJobManager holds a job's USDC cost in escrow. The first eligible agent whose application succeeds is assigned immediately. The agent submits work, validators review it, and a separate finalization transaction settles the job when its timing and voting conditions allow. Moderators handle disputes.

## Start here

Open the [USDC console](../ui/agijobmanager-usdc.html) or use the verified contract's Etherscan Read/Write tabs. Confirm the deployment address, Ethereum network, and `usdcToken()` before approving spending. A published software release does not itself create a live deployment.

| Role | Next guide |
| --- | --- |
| Employer | [Post and fund a job](roles/EMPLOYER.md) |
| Agent | [Qualify, apply, and submit work](roles/AGENT.md) |
| Validator | [Review work and post a vote bond](roles/VALIDATOR.md) |
| Moderator | [Resolve a disputed job](roles/MODERATOR.md) |
| Owner/operator | [Configure and operate the deployment](roles/OWNER_OPERATOR.md) |

## Money: USDC for jobs, ETH for gas

Ethereum mainnet uses native Circle USDC at `0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48`. USDC has six decimals: **100 USDC = 100000000 base units**. Escrow, validator rewards, and agent/validator/dispute bonds all use USDC. Wallet transactions still require ETH for Ethereum gas.

Successful settlement distributes the original job cost in this order:

| Recipient | Default share | For a 100 USDC job |
| --- | --- | --- |
| Correct-side validators, first | 8% reward budget | 8 USDC shared |
| `wallet30` | Fixed 30% of the original cost | 30 USDC |
| `wallet10` | Fixed 10% of the original cost | 10 USDC |
| Assigned agent | Remainder | 52 USDC |

The owner can set the validator budget from 1–60% for **new jobs**. Each job keeps the percentage recorded when it was posted. Both wallet percentages stay fixed. Amounts round down to whole USDC base units; the agent receives the remainder on success, including undistributed validator rewards. Bond returns and slashing are separate from these job-cost percentages.

If nobody votes, successful finalization after the review window pays no validator reward: the agent receives the remainder after the two wallet shares. Cancelled, expired, and employer-win jobs do not pay the 30%/10% shares. An employer-win refund can be reduced by validator rewards and adjusted by bond settlement; it is not always a full refund.

## Before a transaction

1. Check the contract, network, role, current job state, and relevant deadlines in the console.
2. Read the USDC amount required for the action. Approve that amount to the manager on the USDC contract. Approval and the job action are separate transactions; use the same wallet for both.
3. Keep enough USDC for escrow or the relevant bond, plus ETH for gas. Avoid unlimited allowances; clear unused allowances when no longer needed.
4. Review the action preview, then sign and wait for confirmation. A failed USDC transfer rolls the settlement back; some ENS metadata hooks can fail without undoing an otherwise successful settlement.

AGI Agents normally qualify through a name under `agent.agi.eth` or `alpha.agent.agi.eth`; AGI Validators through `club.agi.eth` or `alpha.club.agi.eth`. The connected wallet must satisfy the configured name's NameWrapper ownership/approval or resolver-address check. Enter only the label, such as `alice`. The contract preserves owner-managed `additionalAgents`/`additionalValidators` and role-specific Merkle proofs as explicit membership exceptions; those routes are not proof of ENS membership. Agents also need a qualifying enabled NFT. These participant identity checks are separate from optional ENS job-page metadata. Agents and validators must also fund their required USDC bonds; an identity exception does not waive NFT, blacklist, lifecycle or funding checks. NFT credentials do not increase payment percentages.

## Job lifecycle

1. **Employer posts.** Call `createJob(jobSpecURI, payout, duration, details)` after approving the exact USDC cost. Duration is in seconds, within `jobDurationLimit`; its clock begins at assignment. Read the new ID from `JobCreated`.
2. **Agent applies.** Call `applyForJob(jobId, subdomain, proof)` with enough approved USDC for the performance bond. The first successful eligible application assigns the job; there is no later employer-selection transaction.
3. **Agent submits.** Call `requestJobCompletion(jobId, jobCompletionURI)` by the assignment deadline. Supply a valid metadata URI, such as `ipfs://...` or `https://...`.
4. **Validators vote once each.** After completion is requested and within the review window, eligible validators call either `validateJob` or `disapproveJob`. Each vote transfers its required bond; a vote does not itself pay the job.
5. **Someone finalizes.** Anyone can call `finalizeJob(jobId)` when allowed. A qualifying approval threshold starts a challenge window; early success requires that window to have passed, approvals to exceed disapprovals, and no active dispute. Otherwise, wait until the completion review window has passed: no votes complete the job; an under-quorum result or tie opens a dispute; a qualifying majority settles according to its outcome.
6. **Verify settlement.** Successful work emits `JobPayoutDistributed`, `JobCompleted`, and `NFTIssued`, pays USDC, and mints an ERC-721 receipt to the employer. The receipt URI may use configured ENS metadata or the completion URI/base fallback. The contract has no built-in NFT marketplace.

Read the deployment's actual timer values. Defaults are a seven-day completion review, one-day approval challenge, and fourteen-day stale-dispute review. Calls that require a window to have elapsed must be **strictly after** its boundary. Early finalization can happen before the full completion review window ends. When an approval threshold has already been reached, its challenge window must also strictly elapse before finalization, even if the completion review window ends first.

## Cancel, expire, or dispute

- The employer can `cancelJob` while the job remains unassigned. The owner can delist an unassigned job.
- Anyone can `expireJob` strictly after the assignment deadline if no completion request or active dispute exists. Escrow and the forfeited agent bond go to the employer.
- The employer or assigned agent can `disputeJob` after completion was requested, within its review window, and before settlement. Approve the dispute bond first. A reached disapproval threshold can also open a dispute.
- A moderator uses `resolveDisputeWithCode(jobId, code, reason)`: `0` records a note, `1` settles for the agent, `2` refunds the employer under the contract's reward/bond rules.
- After the stale-dispute deadline, the owner can call `resolveStaleDispute`. These decisions require signed transactions; time passing alone never executes them.

## What the owner can change

The deployment has no implementation upgrade switch. Its USDC address and fixed 30%/10% shares cannot be changed. The owner can maintain allowlists, moderator roles, selected limits and bond settings. Existing agent bonds are fixed at assignment, and a job's validator bond is fixed by its first vote. Some rules can change only when every escrow/bond reserve is zero. Settlement recipients can rotate only then, with intake paused. Ownership transfer requires acceptance by the proposed owner. See the [owner controls](OWNER_CONTROLS.md) for exact restrictions.

New deployments start with intake paused until owner commissioning. Intake pause blocks posting/application; settlement pause also blocks completion, voting, disputes, and settlement. Check both states before acting.

## More help

- [End-to-end walkthrough](user-guide/happy-path.md)
- [Identity and Merkle proofs](user-guide/merkle-proofs.md)
- [Common reverts](user-guide/common-reverts.md) and [troubleshooting](TROUBLESHOOTING.md)
- [Contract reference](REFERENCE.md), [testing](TESTING.md), and [security practices](SECURITY_BEST_PRACTICES.md)

For a disposable local demonstration, use the repository's tested fixtures and commands in [Testing](TESTING.md). Public-network deployment uses the Hardhat workflow; local regression tests use Hardhat 3 through `npm test`.
