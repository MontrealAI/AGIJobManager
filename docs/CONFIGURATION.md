# Configuration Reference (Operator / Owner)

## Configuration locking model

`lockIdentityConfiguration()` permanently freezes identity wiring setters guarded by `whenIdentityConfigurable`:
- `updateAGITokenAddress`
- `updateEnsRegistry`
- `updateNameWrapper`
- `setEnsJobPages`
- `updateRootNodes`
- `updateMerkleRoots`

It **does not** freeze operational controls like pause, settlement pause, thresholds, bond params, blacklists, moderators, or AGI types.

## Config keys table

| Variable | Setter | Owner-only | Guard conditions | Operational notes |
|---|---|---:|---|---|
| `requiredValidatorApprovals` | `setRequiredValidatorApprovals` | Yes | thresholds validated; `<= MAX_VALIDATORS_PER_JOB` | Early-approval latch trigger |
| `requiredValidatorDisapprovals` | `setRequiredValidatorDisapprovals` | Yes | same threshold validation | Disapproval dispute trigger |
| `voteQuorum` | `setVoteQuorum` | Yes | `1..MAX_VALIDATORS_PER_JOB` | Slow-path finalize quorum gate |
| `validationRewardPercentage` | `setValidationRewardPercentage` | Yes | `1..100` and `max AGI payout <= 100 - reward` | Validator escrow budget share |
| `maxJobPayout` | `setMaxJobPayout` | Yes | none explicit | Caps `createJob` payout |
| `jobDurationLimit` | `setJobDurationLimit` | Yes | none explicit | Caps `createJob` duration and agent-bond scaling bound |
| `completionReviewPeriod` | `setCompletionReviewPeriod` | Yes | `1..365 days` | Vote/dispute window after completion request |
| `disputeReviewPeriod` | `setDisputeReviewPeriod` | Yes | `1..365 days` | Stale-dispute owner recovery delay |
| `challengePeriodAfterApproval` | `setChallengePeriodAfterApproval` | Yes | `1..365 days` | Delay after approval threshold before finalize |
| `validatorBondBps/min/max` | `setValidatorBondParams` | Yes | consistency checks; supports full disable only with all zero | Per-vote validator bond sizing |
| `agentBondBps/min/max` | `setAgentBondParams` | Yes | checks, supports all-zero disable | Agent performance bond sizing |
| `agentBond` (min alias) | `setAgentBond` | Yes | none | Legacy single-field min update |
| `validatorSlashBps` | `setValidatorSlashBps` | Yes | `<= 10_000` | Slash share for wrong validators |
| `premiumReputationThreshold` | `setPremiumReputationThreshold` | Yes | none | Used by `canAccessPremiumFeature` |
| `baseIpfsUrl` | `setBaseIpfsUrl` | Yes | none | Applied when token URI has no scheme |
| `termsAndConditionsIpfsHash` | `updateTermsAndConditionsIpfsHash` | Yes | none | Informational metadata |
| `contactEmail` | `updateContactEmail` | Yes | none | Informational metadata |
| `additionalText1/2/3` | `updateAdditionalText1/2/3` | Yes | none | Informational metadata |
| `settlementPaused` | `setSettlementPaused` | Yes | none | Blocks settlement-sensitive functions via custom modifier |
| Pause state | `pause`/`unpause` | Yes | OpenZeppelin Pausable | Pausing required for treasury withdraw |
| `agiToken` | `updateAGITokenAddress` | Yes | identity-configurable + empty locked balances + nonzero address | High impact; do before production jobs |
| `ens` | `updateEnsRegistry` | Yes | identity-configurable + nonzero + empty locked balances required | Identity gating dependency |
| `nameWrapper` | `updateNameWrapper` | Yes | identity-configurable + nonzero + empty locked balances required | Wrapped-root checks dependency |
| `ensJobPages` | `setEnsJobPages` | Yes | identity-configurable; contract code required if nonzero | Enables lifecycle hooks |
| `useEnsJobTokenURI` | `setUseEnsJobTokenURI` | Yes | none | Pulls NFT tokenURI from ENSJobPages when available |
| Root nodes | `updateRootNodes` | Yes | identity-configurable + empty locked balances required | club/agent + alpha variants |
| Merkle roots | `updateMerkleRoots` | Yes | identity-configurable | validator/agent allowlist roots |
| Moderators | `addModerator/removeModerator` | Yes | nonzero address helper check | Dispute resolution role |
| Additional allowlists | `add/removeAdditionalAgent`, `add/removeAdditionalValidator` | Yes | nonzero address | Bypass ENS/Merkle ownership checks |
| Blacklists | `blacklistAgent`, `blacklistValidator` | Yes | none | Hard deny lists |
| AGI payout tiers | `addAGIType`, `disableAGIType` | Yes | ERC721 support, max count, payout headroom checks | Controls agent payout % by NFT holdings |

## Roles and permissions matrix

| Action class | Owner | Moderator | Employer | Agent | Validator |
|---|---:|---:|---:|---:|---:|
| Create/cancel own job |  |  | ✅ |  |  |
| Delist pre-assignment job | ✅ |  |  |  |  |
| Apply for open job |  |  |  | ✅ |  |
| Request completion (assigned only) |  |  |  | ✅ |  |
| Vote validate/disapprove |  |  |  |  | ✅ |
| Raise dispute |  |  | ✅ | ✅ |  |
| Resolve dispute |  | ✅ |  |  |  |
| Resolve stale dispute | ✅ |  |  |  |  |
| Set config parameters | ✅ |  |  |  |  |
| Manage allowlists/blacklists | ✅ |  |  |  |  |
| Pause/unpause and settlement pause | ✅ |  |  |  |  |
| Withdraw treasury surplus (paused only) | ✅ |  |  |  |  |

## Defaults at deployment

Defaults are in-code unless changed post-deploy:
- approvals/disapprovals/quorum: `3 / 3 / 3`
- validation reward: `8%`
- max payout: `88,888,888e18`
- job duration limit: `10,000,000`
- completion/dispute review: `7 days / 14 days`
- validator bond: `1500 bps`, min `10e18`, max `88,888,888e18`
- validator slash: `8000 bps`
- challenge period after approval: `1 day`
- agent bond params: `500 bps`, min `1e18`, max `88,888,888e18`
- dispute bond constants: `50 bps`, min `1e18`, max `200e18`
