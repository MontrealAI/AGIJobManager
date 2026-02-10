# Glossary

## Purpose
Normalize project terminology for contributors, auditors, and operators.

## Terms
- **Employer**: Job creator funding payout escrow in AGI tokens.
- **Agent**: Assignee completing job work; posts agent bond on apply.
- **Validator**: Permissioned participant voting approve/disapprove on completion requests, with validator bond per vote.
- **Moderator**: Trusted role authorized to resolve disputes.
- **Owner**: Privileged operator controlling config, role management, pause controls, and treasury withdrawal of surplus only.
- **Job escrow**: AGI payout amount locked per unsettled job (`lockedEscrow`).
- **Agent bond**: Agent stake locked until job settlement (`lockedAgentBonds`).
- **Validator bond**: Vote stake locked until settlement (`lockedValidatorBonds`).
- **Dispute bond**: Stake posted when opening a dispute (`lockedDisputeBonds`).
- **Settlement paused**: Dedicated switch that blocks major settlement endpoints independent of global pause.
- **Identity lock**: Irreversible freeze of token/ENS/root/merkle/ENSJobPages wiring (`lockIdentityConfiguration`).
- **AGIType**: Optional ERC721 ownership-gated profile defining max allowable agent payout percentage.
- **Challenge period after approval**: Delay between threshold approval and finalization.
- **Completion NFT**: ERC-721 token minted to employer when job settles as completed.
- **ENS hook**: Best-effort callback from AGIJobManager into ENSJobPages for metadata updates.
- **Wrapped root**: ENS root node controlled by NameWrapper rather than direct ENS owner.
- **Fuses**: NameWrapper permission bits (e.g., `CANNOT_SET_RESOLVER`, `CANNOT_SET_TTL`) optionally burned on lock.
- **Platform retained revenue**: Remainder in agent-win settlement after agent payout plus validator budget.

## References
- [`../contracts/AGIJobManager.sol`](../contracts/AGIJobManager.sol)
- [`../contracts/ens/ENSJobPages.sol`](../contracts/ens/ENSJobPages.sol)
