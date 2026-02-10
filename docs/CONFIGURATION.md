# Configuration Reference (Operator)

## Identity wiring and lock behavior

`lockIdentityConfiguration()` permanently disables identity-wiring setters guarded by `whenIdentityConfigurable`:
- `updateAGITokenAddress`
- `updateEnsRegistry`
- `updateNameWrapper`
- `setEnsJobPages`
- `updateRootNodes`

Operational controls (pause, thresholds, bonds, moderators, blacklists, etc.) remain owner-controlled after lock.

## Config keys

| Variable / concern | Setter(s) | Owner-only | Guard conditions | Notes |
|---|---|---:|---|---|
| `agiToken` | `updateAGITokenAddress(address)` | Yes | non-zero, identity configurable, empty escrow | Migration-critical; cannot rotate with active obligations |
| `ens` | `updateEnsRegistry(address)` | Yes | non-zero, identity configurable, empty escrow | Identity source |
| `nameWrapper` | `updateNameWrapper(address)` | Yes | non-zero, identity configurable, empty escrow | Wrapped ENS support |
| `ensJobPages` | `setEnsJobPages(address)` | Yes | identity configurable; non-zero must contain code | Optional best-effort hook target |
| `clubRootNode` / `agentRootNode` / alpha roots | `updateRootNodes(...)` | Yes | identity configurable, empty escrow | ENS namespace gates |
| Merkle roots | `updateMerkleRoots(validatorRoot,agentRoot)` | Yes | none beyond ownership | Can rotate live |
| `useEnsJobTokenURI` | `setUseEnsJobTokenURI(bool)` | Yes | none | Controls NFT tokenURI preference |
| `requiredValidatorApprovals` | `setRequiredValidatorApprovals(uint256)` | Yes | validated with disapproval threshold | Total threshold bounds enforced |
| `requiredValidatorDisapprovals` | `setRequiredValidatorDisapprovals(uint256)` | Yes | validated with approval threshold | Total threshold bounds enforced |
| `voteQuorum` | `setVoteQuorum(uint256)` | Yes | `1..MAX_VALIDATORS_PER_JOB` | Quorum for decisive voting |
| `validationRewardPercentage` | `setValidationRewardPercentage(uint256)` | Yes | `1..100` and compatible with AGI-type max payout | Validator reward budget |
| `validatorBond*` | `setValidatorBondParams(bps,min,max)` | Yes | bps<=10000; min<=max; valid zero/disable shape | Vote bond sizing |
| `agentBond*` | `setAgentBondParams(bps,min,max)` / `setAgentBond(uint256)` | Yes | bps<=10000; min<=max; max>0 unless full zero disable | Apply bond sizing |
| `validatorSlashBps` | `setValidatorSlashBps(uint256)` | Yes | bps<=10000 | Slash severity |
| Review/challenge windows | `setCompletionReviewPeriod`, `setDisputeReviewPeriod`, `setChallengePeriodAfterApproval` | Yes | each >0 and <=365 days | Liveness/timing |
| `maxJobPayout` | `setMaxJobPayout(uint256)` | Yes | none | Input bound for job creation |
| `jobDurationLimit` | `setJobDurationLimit(uint256)` | Yes | none | Input bound for job creation |
| AGI type tiers | `addAGIType`, `disableAGIType` | Yes | ERC-721 check; max 32 entries; payout+validator reward <=100 | Controls eligible payout tiers |
| Metadata/admin text | `setBaseIpfsUrl`, `updateTermsAndConditionsIpfsHash`, `updateContactEmail`, `updateAdditionalText1/2/3` | Yes | none | Pure metadata |
| Premium feature threshold | `setPremiumReputationThreshold(uint256)` | Yes | none | Affects `canAccessPremiumFeature` only |
| Settlement pause | `setSettlementPaused(bool)` | Yes | none | Blocks settlement-gated operations |

## Roles and permissions matrix

| Action | owner | moderator | employer | agent | validator |
|---|---:|---:|---:|---:|---:|
| Configure contract parameters | ✅ | ❌ | ❌ | ❌ | ❌ |
| Pause/unpause (`Pausable`) | ✅ | ❌ | ❌ | ❌ | ❌ |
| Set `settlementPaused` | ✅ | ❌ | ❌ | ❌ | ❌ |
| Add/remove moderator | ✅ | ❌ | ❌ | ❌ | ❌ |
| Add/remove allowlisted agent/validator | ✅ | ❌ | ❌ | ❌ | ❌ |
| Blacklist agent/validator | ✅ | ❌ | ❌ | ❌ | ❌ |
| Create job | ❌ | ❌ | ✅ | ❌ | ❌ |
| Apply for job | ❌ | ❌ | ❌ | ✅ | ❌ |
| Request completion | ❌ | ❌ | ❌ | ✅ (assigned) | ❌ |
| Vote approve/disapprove | ❌ | ❌ | ❌ | ❌ | ✅ |
| Open dispute | ❌ | ❌ | ✅ (job employer) | ✅ (assigned agent) | ❌ |
| Resolve dispute manually | ❌ | ✅ | ❌ | ❌ | ❌ |
| Resolve stale dispute | ✅ | ❌ | ❌ | ❌ | ❌ |
| Withdraw treasury surplus | ✅ | ❌ | ❌ | ❌ | ❌ |

## Operator notes

- `withdrawAGI` requires both `paused == true` and `settlementPaused == false`.
- `setAdditionalAgentPayoutPercentage` is deprecated and always reverts with `DeprecatedParameter`.
- Identity lock is irreversible.
