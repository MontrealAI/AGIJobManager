# Configuration Reference — v0.9.0

The deployed manager has no implementation upgrade switch. Its native USDC address and fixed successful-job 30%/10% shares cannot change. Owner controls maintain selected operating parameters; they do not permit withdrawal of reserved escrow or bonds. See [owner controls](OWNER_CONTROLS.md) for transaction procedures.

## Configuration locking model

`lockIdentityConfiguration()` permanently freezes `updateEnsRegistry`, `updateNameWrapper`, `setEnsJobPages`, and `updateRootNodes`. It does not freeze Merkle-root updates, role lists, NFT credentials, pause controls, or other operating parameters.

“Empty reserves” below means **all four** counters are zero: `lockedEscrow`, `lockedAgentBonds`, `lockedValidatorBonds`, and `lockedDisputeBonds`. Donations can remain. Intake pause and empty reserves are different conditions.

## Config keys table

All setters below are owner-only.

| Variable | Setter | Guard conditions | Operational notes |
| --- | --- | --- | --- |
| `wallet30`, `wallet10` | `setSettlementWallets` | Intake paused; empty reserves; nonzero/distinct recipients; neither manager nor USDC address | Rotates future-job recipients; percentages stay fixed |
| `requiredValidatorApprovals` | `setRequiredValidatorApprovals` | Empty reserves; each threshold and their sum at most 50 | Zero disables the early-approval latch |
| `requiredValidatorDisapprovals` | `setRequiredValidatorDisapprovals` | Empty reserves; same threshold bounds | Zero disables the disapproval-threshold trigger |
| `voteQuorum` | `setVoteQuorum` | Empty reserves; 1–50 | Review-window finalization quorum |
| `validationRewardPercentage` | `setValidationRewardPercentage` | 1–60 | Recorded at posting; only future jobs use a changed rate |
| `maxJobPayout` | `setMaxJobPayout` | No explicit setter bound | Admission cap for new jobs; zero prevents positive-cost posting |
| `jobDurationLimit` | `setJobDurationLimit` | Positive, at most 365 days | Caps newly posted duration; also used when sizing a new agent bond |
| `maxActiveJobsPerAgent` | `setMaxActiveJobsPerAgent` | 1–10000 | Checked at application |
| `completionReviewPeriod` | `setCompletionReviewPeriod` | Empty reserves; positive, at most 365 days | Vote/manual-dispute window after completion request |
| `disputeReviewPeriod` | `setDisputeReviewPeriod` | Empty reserves; positive, at most 365 days | Delay before owner stale-dispute recovery |
| `challengePeriodAfterApproval` | `setChallengePeriodAfterApproval` | Empty reserves; positive, at most 365 days | Must strictly elapse after the approval latch; can outlast review if configured longer |
| `validatorBondBps/min/max` | `setValidatorBondParams` | Bps at most 10000; min ≤ max; positive-bps configurations require positive min/max; all-zero disables | First vote fixes the bond for that job's later voters |
| `agentBondBps/min/max` | `setAgentBondParams` | Bps at most 10000; min ≤ max; positive max unless all-zero disable | Amount fixed when the agent applies; duration premium and payout cap apply |
| `agentBond` | `setAgentBond` | At most configured max; must remain zero if max is zero | Updates the minimum for future assignments, not locked bonds |
| `validatorSlashBps` | `setValidatorSlashBps` | Empty reserves; at most 10000 | Share of an incorrect vote's bond assigned to the outcome pool |
| `premiumReputationThreshold` | `setPremiumReputationThreshold` | No explicit bound | Legacy stored setting; does not change settlement percentages |
| `baseIpfsUrl` | `setBaseIpfsUrl` | At most 512 bytes | Fallback prefix for receipt metadata without a scheme |
| `settlementPaused` | `setSettlementPaused` | Owner | Blocks all settlement-gated actions, including posting/application |
| Intake pause | `pause` / `unpause`, intake aliases | OpenZeppelin pause-state checks | Blocks posting/application; settlement remains possible if enabled |
| Both pauses | `pauseAll` / `unpauseAll` | Owner | Changes both lanes together |
| `ens` | `updateEnsRegistry` | Identity unlocked; empty reserves; address has code | ENS identity dependency |
| `nameWrapper` | `updateNameWrapper` | Identity unlocked; empty reserves; zero or address with code | Zero disables the wrapper route; resolver fallback can remain |
| `ensJobPages` | `setEnsJobPages` | Identity unlocked; zero or address with code | Best-effort lifecycle metadata hooks |
| `useEnsJobTokenURI` | `setUseEnsJobTokenURI` | Owner | Enables bounded ENS receipt-URI lookup with fallback |
| ENS root nodes | `updateRootNodes` | Identity unlocked; empty reserves | Agent/club roots and their alpha alternatives |
| Merkle roots | `updateMerkleRoots` | Owner; remains available after identity lock | Live agent/validator allowlists; users must refresh proofs |
| Moderators | `addModerator` / `removeModerator` | Owner | Only listed moderators use typed dispute resolution |
| Additional allowlists | `add/removeAdditionalAgent`, `add/removeAdditionalValidator` | Owner | Identity bypass only; agent NFT credentials remain required |
| Blacklists | `blacklistAgent`, `blacklistValidator` | Owner | Blocks application or voting for that role |
| NFT eligibility scores | `addAGIType`, `disableAGIType` | Add: ERC-721 support, score 1–100, at most 32 registered slots | Eligibility only; scores do not set the USDC payout |

The role-list setters do not reject every unsuitable account automatically. Review the intended accounts operationally. The current ABI has no legacy terms/contact/additional-text setters or additional-agent payout setter.

## Roles and permissions matrix

| Action class | Who can call |
| --- | --- |
| Create a funded job | Any employer wallet while intake/settlement allow it |
| Cancel an unassigned job | That job's employer |
| Delist an unassigned job | Owner |
| Apply | Eligible, non-blacklisted agent with NFT credential and required bond |
| Request completion | Assigned agent |
| Validate/disapprove | Eligible, non-blacklisted validator with required bond; one vote per job |
| Manual dispute | Employer or assigned agent after submission, within review, before settlement |
| Typed dispute resolution | Listed moderator |
| Stale-dispute resolution | Owner, strictly after the stale deadline |
| Finalize/expire | Anyone, when the corresponding state/timer conditions allow |
| Withdraw unreserved USDC | Owner, with intake paused and settlement enabled |
| Ownership transfer | Current owner proposes; proposed owner accepts |

## Defaults at deployment

- Intake paused; settlement pause false. Commission before enabling intake.
- Approvals/disapprovals/quorum: `3 / 3 / 3`.
- Validator budget: `8%`; successful-job wallet shares: `30% / 10%`.
- Maximum job cost: `88888888e6` USDC base units; duration limit: `10000000` seconds.
- Completion/dispute review: `7 days / 14 days`; approval challenge: `1 day`.
- Validator bond: `1500` bps, minimum `10e6`, maximum `88888888e6`; incorrect-vote slash: `8000` bps.
- Agent bond: `500` bps, minimum `1e6`, maximum `88888888e6`; active-job limit: `3`.
- Manual dispute bond constants: `50` bps, minimum `1e6`, maximum `200e6`, capped at job cost.

Read the live deployment; an owner may have changed permitted settings. Agent bonds are fixed at assignment, validator bonds at the first vote, and validator reward percentages at posting. No-vote completion pays no validator reward. All money amounts use six-decimal USDC; ETH is still needed for gas.
