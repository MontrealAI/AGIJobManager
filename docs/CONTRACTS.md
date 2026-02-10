# Contracts and Permissions

## Contract map

- `contracts/AGIJobManager.sol`: core escrow, role gating, validator voting, disputes, settlement, NFT minting.
- `contracts/ens/ENSJobPages.sol`: optional ENS hook target for job subname creation and post-settlement lock/revoke.
- Utility libraries used by `AGIJobManager`: `BondMath`, `ReputationMath`, `TransferUtils`, `UriUtils`, `ENSOwnership`.

## Role / permission matrix

| Action | Owner | Moderator | Employer | Agent | Validator | Public |
|---|---:|---:|---:|---:|---:|---:|
| Pause/unpause | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Set `settlementPaused` | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Create job | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ |
| Apply for job | ❌ | ❌ | ❌ | ✅ (if authorized) | ❌ | ❌ |
| Request completion | ❌ | ❌ | ❌ | ✅ assigned agent only | ❌ | ❌ |
| Validate/disapprove | ❌ | ❌ | ❌ | ❌ | ✅ (if authorized) | ❌ |
| Dispute job | ❌ | ❌ | ✅ employer | ✅ assigned agent | ❌ | ❌ |
| Resolve dispute | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Resolve stale dispute | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Finalize job | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Lock ENS page (without fuse burn) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Lock ENS page (with fuse burn) | ✅ only | ❌ | ❌ | ❌ | ❌ | ❌ |
| Owner treasury withdrawal (`withdrawAGI`) | ✅ (paused + settlement active) | ❌ | ❌ | ❌ | ❌ | ❌ |

## Critical configuration knobs

| Parameter | Default | Setter | Key guardrails |
|---|---:|---|---|
| `requiredValidatorApprovals` | `3` | `setRequiredValidatorApprovals` | approvals/disapprovals each ≤ `MAX_VALIDATORS_PER_JOB`, and sum ≤ cap |
| `requiredValidatorDisapprovals` | `3` | `setRequiredValidatorDisapprovals` | same threshold constraint |
| `voteQuorum` | `3` | `setVoteQuorum` | must be `1..MAX_VALIDATORS_PER_JOB` |
| `validationRewardPercentage` | `8` | `setValidationRewardPercentage` | `1..100`; must leave room for max AGI type payout |
| `maxJobPayout` | `88888888e18` | `setMaxJobPayout` | used by `createJob` input validation |
| `jobDurationLimit` | `10000000` | `setJobDurationLimit` | used by `createJob` input validation |
| `completionReviewPeriod` | `7 days` | `setCompletionReviewPeriod` | `>0` and `<=365 days` |
| `disputeReviewPeriod` | `14 days` | `setDisputeReviewPeriod` | `>0` and `<=365 days` |
| `challengePeriodAfterApproval` | `1 days` | `setChallengePeriodAfterApproval` | `>0` and `<=365 days` |
| Validator bond params | `1500 / 10e18 / 88888888e18` | `setValidatorBondParams` | bps ≤ 10000; min/max consistency |
| Agent bond params | `500 / 1e18 / 88888888e18` | `setAgentBondParams` | bps ≤ 10000; min/max consistency; supports full disable via 0/0/0 |
| `validatorSlashBps` | `8000` | `setValidatorSlashBps` | bps ≤ 10000 |
| ENS/identity addresses + roots | set in constructor | `updateAGITokenAddress`, `updateEnsRegistry`, `updateNameWrapper`, `setEnsJobPages`, `updateRootNodes` | identity-configurable only until `lockIdentityConfiguration`; some require empty escrow |
| Merkle roots | deploy config | `updateMerkleRoots` | owner only |
| AGI type table | empty | `addAGIType`, `disableAGIType` | ERC-721 support check, max 32 entries, percentage sum safety with validation reward |

Notes:
- `setAdditionalAgentPayoutPercentage` is deprecated and reverts (`DeprecatedParameter`).
- `lockIdentityConfiguration` freezes identity wiring but does not remove owner operational controls.
