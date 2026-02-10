# Glossary

- **Employer**: Job creator who escrows payout funds.
- **Agent**: Worker assigned to complete a job; posts an agent bond.
- **Validator**: Permissioned reviewer who votes approve/disapprove and posts validator bond.
- **Moderator**: Trusted role authorized to resolve disputes.
- **Dispute bond**: Bond posted by disputing party during active dispute.
- **Validator bond**: Per-vote bond used for validator incentive/slashing.
- **Agent bond**: Bond posted on assignment; returned or slashed based on settlement.
- **Escrow**: Employer payout locked until settlement.
- **Retained revenue**: Agent-win payout remainder left in contract after agent payout + validator budget.
- **ENS root node**: Namehash of parent ENS domain under which job names are created.
- **Labelhash**: `keccak256(label)` used to derive ENS subnodes.
- **Fuses**: ENS NameWrapper permission bits (e.g., `CANNOT_SET_RESOLVER`, `CANNOT_SET_TTL`) optionally burned for immutability.
