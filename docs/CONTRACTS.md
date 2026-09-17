# Contracts and Permissions — v0.9.5

## Contract map

- `contracts/AGIJobManager.sol`: core escrow, role gating, validator voting, disputes, settlement, NFT minting.
- `contracts/ens/ENSJobPages.sol`: optional ENS hook target for job subname creation and post-settlement lock/revoke.
- Utility libraries used by `AGIJobManager`: `BondMath`, `ReputationMath`, `TransferUtils`, `UriUtils`, `ENSOwnership`, `NftEligibility`, `JobSettlement`, `JobValidation`.

The manager uses native USDC for escrow, rewards and bonds. Successful settlement pays validators first, then fixed 30%/10% shares of original cost to the configured wallets, then the agent remainder. NFT credentials establish eligibility only. See [payout rules](USDC_PAYOUT_SPLIT.md).

## Role / permission matrix

| Action | Owner | Moderator | Employer | Agent | Validator | Public |
|---|---:|---:|---:|---:|---:|---:|
| Pause/unpause | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Set `settlementPaused` | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Create job | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ |
| Apply for job | ❌ | ❌ | ❌ | ✅ (identity + NFT credential + bond) | ❌ | ❌ |
| Request completion | ❌ | ❌ | ❌ | ✅ assigned agent only | ❌ | ❌ |
| Validate/disapprove | ❌ | ❌ | ❌ | ❌ | ✅ (if authorized) | ❌ |
| Dispute job | ❌ | ❌ | ✅ employer | ✅ assigned agent | ❌ | ❌ |
| Resolve dispute | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Resolve stale dispute | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Finalize job | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Lock ENS page (without fuse burn) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Lock ENS page (with fuse burn) | ✅ only | ❌ | ❌ | ❌ | ❌ | ❌ |
| Owner treasury withdrawal (`withdrawUSDC`) | ✅ (paused + settlement active) | ❌ | ❌ | ❌ | ❌ | ❌ |

## Critical configuration knobs

| Parameter | Default | Setter | Key guardrails |
|---|---:|---|---|
| `requiredValidatorApprovals` | `3` | `setRequiredValidatorApprovals` | empty reserves; each threshold and their sum ≤50 |
| `requiredValidatorDisapprovals` | `3` | `setRequiredValidatorDisapprovals` | empty reserves; same threshold constraint |
| `voteQuorum` | `3` | `setVoteQuorum` | empty reserves; 1–50 |
| `validationRewardPercentage` | `8` | `setValidationRewardPercentage` | 1–60; fixed per job at posting, changes affect only new jobs |
| `maxJobPayout` | `88888888e6` | `setMaxJobPayout` | used by `createJob` input validation |
| `jobDurationLimit` | `10000000` | `setJobDurationLimit` | positive and at most 365 days; admission and new agent-bond sizing |
| `completionReviewPeriod` | `7 days` | `setCompletionReviewPeriod` | empty reserves; positive and at most 365 days |
| `disputeReviewPeriod` | `14 days` | `setDisputeReviewPeriod` | empty reserves; positive and at most 365 days |
| `challengePeriodAfterApproval` | `1 days` | `setChallengePeriodAfterApproval` | empty reserves; positive and at most 365 days |
| Validator bond params | `1500 / 10e6 / 88888888e6` | `setValidatorBondParams` | bps ≤ 10000; min/max consistency |
| Agent bond params | `500 / 1e6 / 88888888e6` | `setAgentBondParams` | bps ≤ 10000; min/max consistency; supports full disable via 0/0/0 |
| `validatorSlashBps` | `8000` | `setValidatorSlashBps` | empty reserves; bps ≤10000 |
| Merkle roots | deploy config | `updateMerkleRoots` | owner only |
| Agent NFT requirement | true | `setAgentNftRequired`, `jobAgentNftRequired` | Future-posting default; existing job policy cannot change |
| AGI type table | empty | `addAGIType`, `disableAGIType` | Zero reserves to change; ERC-721 support, at most 32 entries, score 1–100; no payout bonus |

Notes:
- Empty reserves means all job escrow, agent bonds, validator bonds and dispute bonds are zero.
- Recipient rotation requires that state plus intake paused; the USDC address and shares are fixed.
- Agent bonds are fixed at assignment and validator bonds at first vote.
- The current ABI has no additional-agent payout setter or string-based dispute-resolution function.
- `lockIdentityConfiguration` freezes identity wiring but does not remove owner operational controls.

For the complete operating guards, use [Configuration](CONFIGURATION.md). Intake pause blocks creation/application; settlement pause also blocks completion, voting and settlement. Owner withdrawals protect all reserves and require settlement enabled.
