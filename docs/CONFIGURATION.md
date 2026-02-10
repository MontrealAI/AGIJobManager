# Configuration Reference (Operator-Focused)

## Configuration locking and scope

`lockIdentityConfiguration()` permanently freezes identity wiring updates guarded by `whenIdentityConfigurable`:
- `updateAGITokenAddress`
- `updateEnsRegistry`
- `updateNameWrapper`
- `setEnsJobPages`
- `updateRootNodes`

Even before lock, these identity updates require empty obligations (`_requireEmptyEscrow`): no active escrow or locked bonds.

## Config keys and setter matrix

| Variable | Default | Setter | Owner-only | Key guard conditions | Operational notes |
|---|---:|---|---|---|---|
| `requiredValidatorApprovals` | `3` | `setRequiredValidatorApprovals` | Yes | combined approval/disapproval limits must stay within `MAX_VALIDATORS_PER_JOB` | Affects fast-approval path and validator-approved timestamping. |
| `requiredValidatorDisapprovals` | `3` | `setRequiredValidatorDisapprovals` | Yes | same threshold validation | Affects disapproval-triggered dispute. |
| `voteQuorum` | `3` | `setVoteQuorum` | Yes | must be `1..MAX_VALIDATORS_PER_JOB` | Used by slow path in `finalizeJob`. |
| `premiumReputationThreshold` | `10000` | `setPremiumReputationThreshold` | Yes | none | Used by `canAccessPremiumFeature`. |
| `validationRewardPercentage` | `8` | `setValidationRewardPercentage` | Yes | `1..100`; AGI-type max payout must remain `<= 100 - validationRewardPercentage` | Sets escrow validator budget share. |
| `maxJobPayout` | `88888888e18` | `setMaxJobPayout` | Yes | none | Upper bound for new jobs. |
| `jobDurationLimit` | `10000000` | `setJobDurationLimit` | Yes | none | Upper bound for new job duration. |
| `completionReviewPeriod` | `7 days` | `setCompletionReviewPeriod` | Yes | non-zero and `<= 365 days` | Validator voting/finalization window anchor. |
| `disputeReviewPeriod` | `14 days` | `setDisputeReviewPeriod` | Yes | non-zero and `<= 365 days` | Delay before `resolveStaleDispute`. |
| `validatorBondBps/min/max` | `1500 / 10e18 / 88888888e18` | `setValidatorBondParams` | Yes | bps<=10000; min<=max; disable mode requires all zero | Used per vote. |
| `agentBondBps/min/max` | `500 / 1e18 / 88888888e18` | `setAgentBondParams` or `setAgentBond` (min only) | Yes | bps<=10000; min<=max; disable only when all zero | Used at apply time. |
| `validatorSlashBps` | `8000` | `setValidatorSlashBps` | Yes | bps<=10000 | Portion of incorrect validator bond slashed. |
| `challengePeriodAfterApproval` | `1 days` | `setChallengePeriodAfterApproval` | Yes | non-zero and `<= 365 days` | Delay after fast approval before finalize. |
| `settlementPaused` | `false` | `setSettlementPaused` | Yes | none | Stops settlement-sensitive actions via `whenSettlementNotPaused`. |
| pause state | `unpaused` | `pause` / `unpause` | Yes | OZ `Pausable` | Stops `whenNotPaused` flows; completion request intentionally remains callable. |
| `agiToken` | constructor input | `updateAGITokenAddress` | Yes | identity-configurable + empty obligations + nonzero addr | High-impact identity wiring. |
| `ens` | constructor input | `updateEnsRegistry` | Yes | identity-configurable + empty obligations + nonzero addr | Identity gating dependency. |
| `nameWrapper` | constructor input | `updateNameWrapper` | Yes | identity-configurable + empty obligations + nonzero addr | Identity gating dependency. |
| `ensJobPages` | `0x0` | `setEnsJobPages` | Yes | identity-configurable; nonzero must be contract | Hook target for ENS best-effort calls. |
| `useEnsJobTokenURI` | `false` | `setUseEnsJobTokenURI` | Yes | none | If true, NFT URI may prefer ENS URI. |
| root nodes (`club/agent/alpha*`) | constructor inputs | `updateRootNodes` | Yes | identity-configurable + empty obligations | ENS root namespaces for role checks. |
| Merkle roots (`validator`, `agent`) | constructor inputs | `updateMerkleRoots` | Yes | none | Address allowlist proofs. |
| `baseIpfsUrl` | constructor input (`https://ipfs.io/ipfs/` from deploy config) | `setBaseIpfsUrl` | Yes | none | Prefix for URI values with no scheme. |
| metadata strings (`termsAndConditionsIpfsHash`, `contactEmail`, `additionalText1..3`) | empty | corresponding `update*` functions | Yes | none | Informational fields only. |

## Roles and permissions matrix

| Action group | Owner | Moderator | Employer | Agent | Validator |
|---|---:|---:|---:|---:|---:|
| Pause/unpause and settlement pause | ✅ | ❌ | ❌ | ❌ | ❌ |
| Add/remove moderators | ✅ | ❌ | ❌ | ❌ | ❌ |
| Identity wiring updates | ✅ | ❌ | ❌ | ❌ | ❌ |
| Lock identity configuration | ✅ | ❌ | ❌ | ❌ | ❌ |
| Blacklist agent/validator | ✅ | ❌ | ❌ | ❌ | ❌ |
| Create job | ❌ | ❌ | ✅ | ❌ | ❌ |
| Apply for job | ❌ | ❌ | ❌ | ✅ (if authorized/not blacklisted) | ❌ |
| Request completion | ❌ | ❌ | ❌ | ✅ (assigned agent only) | ❌ |
| Validate/disapprove | ❌ | ❌ | ❌ | ❌ | ✅ (if authorized/not blacklisted) |
| Dispute job | ❌ | ❌ | ✅ (job employer) | ✅ (assigned agent) | ❌ |
| Resolve dispute | ❌ | ✅ | ❌ | ❌ | ❌ |
| Resolve stale dispute | ✅ | ❌ | ❌ | ❌ | ❌ |
| Withdraw treasury AGI | ✅ (paused only) | ❌ | ❌ | ❌ | ❌ |

## Additional allowlists / blacklists

- `additionalAgents` and `additionalValidators`: owner-managed bypass lists for role authorization.
- `blacklistedAgents` and `blacklistedValidators`: explicit deny lists that override normal authorization checks.
