# Roles guide — v0.9.4

All job escrow, rewards, and bonds use native USDC. Each sender needs ETH for transaction gas. Verify the network and deployment before approving exact USDC amounts.

## Employer

Post and fund jobs with `createJob`; cancel before assignment; request a bonded dispute after completion submission within the review window and before settlement. The first eligible successful application assigns the job automatically. Successful settlement mints the employer's completion NFT; there is no built-in NFT marketplace. See the [employer guide](../roles/EMPLOYER.md).

## Agent

Apply for an unassigned job, perform its work, and request completion by the assignment deadline. You need an authorized agent identity **and** an eligible AGI-type NFT credential, plus the approved performance bond. Credentials establish eligibility, not a payout bonus. On success, receive the USDC remainder after validators and the fixed 30%/10% gross-cost shares, plus bond settlement. See the [agent guide](../roles/AGENT.md).

Ordinary AGI Agent membership uses `agent.agi.eth` or `alpha.agent.agi.eth`. Use only the label; the wallet must pass the configured wrapper/resolver check. Owner-managed `additionalAgents` and agent Merkle proofs remain explicit membership exceptions. A proof must match the current role root and your connected wallet.

## Validator

After work is submitted, review it and vote once with `validateJob` or `disapproveJob` within the review window. You need validator identity authorization, no blacklist entry, and an approved USDC vote bond. A job's first vote fixes the bond required for every later voter. Correct-side voters share rewards; incorrect-side votes can lose part of their bond. An approval vote never automatically pays the job. See the [validator guide](../roles/VALIDATOR.md).

Ordinary AGI Validator membership uses `club.agi.eth` or `alpha.club.agi.eth`; owner-managed `additionalValidators` and validator Merkle proofs remain explicit exceptions. Agent membership does not automatically grant validator eligibility. Participant identity is separate from optional ENS job-page metadata.

## Moderator

Resolve active disputes with `resolveDisputeWithCode`: `0` records a note, `1` settles for the agent, `2` refunds under employer-win rules. The public reason explains the decision but does not choose it. Your wallet must be explicitly listed as a moderator. The current contract has no string-based `resolveDispute` call. See the [moderator guide](../roles/MODERATOR.md).

## Owner

Maintain roles, allowlists, NFT credentials and selected parameters; manage intake/settlement pauses; recover only unreserved USDC; and resolve stale disputes after their deadline. Some configuration requires every escrow/bond reserve to be zero. Rotating the two settlement recipients additionally requires intake paused. Ownership changes use proposal and acceptance; renunciation is disabled.

The native USDC token and fixed 30%/10% shares cannot change. The deployed contract has no implementation upgrade switch. The validator percentage is fixed for each job when posted; agent bonds are fixed at assignment and validator bonds at first vote. See [owner/operator](../roles/OWNER_OPERATOR.md) and [owner controls](../OWNER_CONTROLS.md).

## Anyone

Anyone may call `finalizeJob` when voting/timing conditions allow, or `expireJob` after an eligible unsubmitted job misses its assignment deadline. A valid role-specific action still requires that role; being able to finalize does not let a caller change recipients or choose a dispute outcome.

Follow the [happy path](happy-path.md) for the full sequence and [Merkle proofs](merkle-proofs.md) for identity inputs.
