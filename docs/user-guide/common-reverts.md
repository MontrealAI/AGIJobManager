# Common reverts and fixes — v1.0.0

Start with the network, deployment address, connected wallet, `usdcToken()`, current job state, both pause states, and deadlines. Check USDC balance/allowance and ETH for gas. The console's preview can explain a failure before you sign.

| Action / error | Meaning and next step |
| --- | --- |
| Apply: `NotAuthorized` | Pass the agent allowlist, Merkle proof, or configured ENS route. Use your own wallet and the label only for ENS. See [proofs](merkle-proofs.md). |
| Apply: `IneligibleAgentPayout` | The job requires an NFT: verify jobAgentNftRequired(jobId) and hold an enabled AGI-type credential. If the registry is empty, the operator must configure it; changing the default does not change this job. |
| Apply: `InvalidState` | Another agent is assigned or your active-job limit is reached. Check `getJobCore` and your existing assignments. |
| Apply/vote: `Blacklisted` | Your wallet is blocked for that role. Contact the operator for review. |
| Submit: `NotAuthorized` | Only the assigned agent can request completion. |
| Submit: `InvalidState` | The job is terminal, a completion request already exists, or the ordinary assignment deadline has passed. Inspect the state before retrying. |
| Submit/create: `InvalidParameters` | Check positive amounts/duration, configured limits, URI format, and text/URI length bounds. |
| Vote: `NotAuthorized` | Pass the validator identity route; agent eligibility does not grant validator eligibility. |
| Vote: `InvalidState` | Completion has not been requested, the job is disputed/terminal, the review window ended, or you already voted. Each validator has one vote. |
| Vote: `ValidatorLimitReached` | The job already has 50 validator votes. |
| Finalize: `InvalidState` | The job is disputed/terminal, lacks a completion request, or the relevant challenge/review window has not strictly elapsed. A valid call can also open a dispute instead of paying. |
| Expire: `InvalidState` | The job is unassigned, terminal/disputed, already has a completion request, or its assignment deadline has not strictly elapsed. |
| Dispute: `NotAuthorized` | Only this job's employer or assigned agent can post a manual dispute. |
| Dispute: `InvalidState` | Completion must already have been requested; the job must remain unsettled/undisputed and within its displayed settlement cutoff, including any longer approval challenge. |
| Moderator decision: `NotModerator` | The calling wallet must be explicitly listed as a moderator. Ownership alone is insufficient for `resolveDisputeWithCode`. |
| Owner overdue-dispute decision: `Ownable: caller is not the owner` | Use the accepted owner wallet for `resolveStaleDispute`; moderator membership alone is insufficient. |
| Resolve: `InvalidParameters` | Use numeric code `0`, `1`, or `2`; freeform reason text does not select the outcome. |
| Resolve: `InvalidState` | No active dispute exists, or a stale-dispute owner call is too early. |
| Cancel: `NotAuthorized` | Use the employer wallet that created the job. |
| Cancel/delist: `InvalidState` | The job is already assigned or terminal. |
| Job action: `JobNotFound` | The ID does not exist or an unassigned job was cancelled/deleted. |
| USDC transfer: `TransferFailed` | Check the required USDC balance and exact allowance. Issuer pause/blocklist restrictions can also prevent transfers, including payouts. Failed outgoing payments become protected claims. An explicit claim retry reverts without losing the entitlement if USDC still blocks it. |
| Intake: `Pausable: paused` | Posting/application is disabled. A fresh deployment starts paused until the owner commissions it. |
| Job action: `SettlementPaused` | The settlement lane is paused; this also blocks posting and application. Wait for owner recovery. |
| Owner withdrawal: `InsufficientWithdrawableBalance` | Amount exceeds unreserved USDC. Use `withdrawableUSDC()`, not the manager's total balance. |
| Withdrawal: `InvalidParameters` | Amount must be positive. USDC withdrawal also requires intake paused and settlement enabled. |
| Configuration/wallet rotation: `InvalidState` | The action requires all escrow and bond reserves to be zero. Wallet rotation additionally requires intake paused. |
| Validation budget: `InvalidParameters` | Use 1–60%; changes apply only to new jobs. |
| Identity configuration: `ConfigLocked` | The owner has irreversibly locked the protected identity configuration. |
| Ownership acceptance | Only `pendingOwner` may call `acceptOwnership`; proposing a transfer does not change `owner` immediately. |

Use [roles](roles.md) and the [walkthrough](happy-path.md) to check the expected sequence. There are no current internal NFT marketplace, reward-pool contribution, or string-based dispute-resolution calls; use the v1.0.0 interface/ABI.
