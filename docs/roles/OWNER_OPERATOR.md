# Owner/Operator Guide

This guide covers administrative operations and safety controls.

## Core responsibilities
- Configure identity gates and allowlists.
- Adjust risk parameters (payout limits, duration limits, validation rewards).
- Manage moderators.
- Pause/unpause the contract in emergencies.
- Withdraw surplus AGI funds when appropriate.

## Administrative actions
> **Screenshot placeholder:** Etherscan “Write Contract” tab showing `pause`/`unpause` actions.
### Pause / unpause
- `pause()` stops most user actions.
- `unpause()` restores normal operations.

### Allowlists and blacklists
- `addAdditionalAgent(address)` / `removeAdditionalAgent(address)`
- `addAdditionalValidator(address)` / `removeAdditionalValidator(address)`
- `blacklistAgent(address, status)`
- `blacklistValidator(address, status)`

### Moderators
- `addModerator(address)`
- `removeModerator(address)`

### Parameter tuning
- `setRequiredValidatorApprovals(uint256)`
- `setRequiredValidatorDisapprovals(uint256)`
- `setValidationRewardPercentage(uint256)`
- `setMaxJobPayout(uint256)`
- `setJobDurationLimit(uint256)`
- `setPremiumReputationThreshold(uint256)`

### Metadata
- `updateTermsAndConditionsIpfsHash(string)`
- `updateContactEmail(string)`
- `updateAdditionalText1/2/3(string)`

### Financial operations
- `withdrawAGI(amount)` withdraws surplus ERC‑20 while paused and reverts if `amount > withdrawableAGI()`.

## Safety checklist
- Use a multisig or hardware wallet for the owner address.
- Pause before making large parameter changes.
- Keep allowlists curated and auditable.
- Use small test payouts after any config change.

## For developers
### State to monitor
- `requiredValidatorApprovals`, `requiredValidatorDisapprovals`
- `maxJobPayout`, `jobDurationLimit`
- `validationRewardPercentage`
- `blacklistedAgents`, `blacklistedValidators`

### Events to index
`AGITypeUpdated`, `RewardPoolContribution`
