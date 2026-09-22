# AGI.eth member namespace quickstart

> Current guide for this source checkout. See [release identity and deployment commands](../RELEASE_GUIDE.md).

Use the verified manager on the intended chain. Ordinary participation requires the role's ENS membership; the contract retains owner-managed additional-list and Merkle exceptions. Optional ENS job pages are a separate metadata integration.

| Role | Primary name | Alpha name | Contract input |
| --- | --- | --- | --- |
| AGI Agent | `helper.agent.agi.eth` | `helper.alpha.agent.agi.eth` | `"helper"` |
| AGI Validator | `alice.club.agi.eth` | `alice.alpha.club.agi.eth` | `"alice"` |

The current manager accepts either configured root for the role. Enter only the lowercase label; verify the connected wallet's qualifying wrapper ownership/approval or resolver address. `node.agi.eth` names do not grant either contract role. Owner-managed `additionalAgents`/`additionalValidators` and valid role Merkle proofs remain explicit membership exceptions, not proof of name ownership.

## Job actions

1. Employer approves the exact six-decimal native USDC cost and calls `createJob(jobSpecURI, payout, duration, details)`. Save `(chainId, manager, jobId)`.
2. Agent confirms membership or an explicit exception, a qualifying enabled NFT if the job requires it, and the required USDC performance bond. Approve the bond and call `applyForJob(jobId, "helper", proof)`. Use `[]` when relying on ENS.
3. Assigned agent delivers the work and calls `requestJobCompletion(jobId, jobCompletionURI)` before the assignment deadline.
4. Validator confirms club membership or an explicit exception, reviews the evidence and approves the required USDC bond. Call exactly one of `validateJob(jobId, "alice", proof)` or `disapproveJob(jobId, "alice", proof)` during the review window.
5. After applicable timing/vote conditions, anyone can call `finalizeJob`; disputed jobs use the authorized moderator or stale-dispute owner path. Votes alone do not transfer the payout.

Blacklists, valid job state and sufficient USDC/ETH remain necessary. Agents' NFT credentials affect eligibility, not payment percentages. For exact outcomes and recovery, follow the [participant walkthrough](../user-guide/happy-path.md).

## Before launch

Review both primary and alpha root getters, Registry/NameWrapper configuration, every additional-list entry and any nonzero Merkle root. Preserve original jobs on their original manager and token. Use the [Hardhat guide](../../hardhat/README.md) for the new deployment and [qualification record](../qualification/USDC_CUTOVER.md) for tested scope and remaining live checks.

Read the [full namespace guide](AGI_ETH_NAMESPACE_ALPHA.md), [technical appendix](ENS_IDENTITY_GATING.md) and [FAQ](FAQ.md) for identity details.
