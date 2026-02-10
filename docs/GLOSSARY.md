# Glossary

- **Employer**: account that creates and funds a job.
- **Agent**: account assigned to execute a job.
- **Validator**: eligible account that votes approve/disapprove on completion.
- **Moderator**: privileged account that resolves disputes.
- **Escrow**: AGI payout held by contract until settlement.
- **Agent bond**: collateral posted by agent on apply.
- **Validator bond**: collateral posted by each validator vote.
- **Dispute bond**: collateral posted when opening dispute.
- **Locked totals**: accounting buckets that must remain fully collateralized by contract balance.
- **Retained revenue**: payout remainder kept in-contract on agent-win after agent payout + validator budget; later withdrawable only under treasury rules.
- **Completion NFT**: ERC-721 token minted to employer when job settles as completed.
- **AGIType**: external ERC-721 collection used to gate/snapshot agent payout percentages.
- **ENS root node**: configured namespace parent for eligibility checks and/or job ENS pages.
- **Labelhash**: `keccak256(label)` value used to derive ENS subnodes.
- **Fuses**: ENS NameWrapper permission bits that can be burned to restrict future changes.
- **Identity lock**: irreversible configuration lock for AGI token + ENS/root wiring.
- **Global pause**: OpenZeppelin `Pausable` state affecting `whenNotPaused` functions.
- **Settlement pause**: dedicated flag affecting settlement-path functions only.
