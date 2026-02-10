# Glossary

## Purpose
Define core protocol terms unambiguously.

- **AGI token**: ERC20 token used for payouts, escrow, and bonds.
- **Job**: On-chain record containing employer, payout, duration, assignee, and settlement fields.
- **Employer**: Party funding escrow and receiving completion NFT.
- **Agent**: Worker address assigned to perform job.
- **Validator**: Permissioned reviewer posting bond and voting approval/disapproval.
- **Moderator**: Privileged dispute resolver.
- **Owner**: Highest-privilege operator account.
- **Completion review period**: Voting window after completion request.
- **Dispute review period**: Timeout window before owner stale-dispute backstop.
- **Challenge period after approval**: Delay after approval-threshold before early finalization.
- **Escrow locked balance (`lockedEscrow`)**: Total unpaid job payouts currently reserved.
- **Locked bonds**: Totals reserved for agent/validator/dispute bonds until settlement.
- **Settlement paused**: Additional kill-switch for settlement endpoints.
- **Identity lock**: Irreversible freeze of identity wiring setters.
- **ENS hook**: Best-effort callback from AGIJobManager into ENSJobPages.
- **AGIType**: External NFT contract + payout percentage used to snapshot agent payout share.
- **Platform retained revenue**: Agent-win remainder after agent + validator allocations.

## References
- [`../contracts/AGIJobManager.sol`](../contracts/AGIJobManager.sol)
- [`../contracts/ens/ENSJobPages.sol`](../contracts/ens/ENSJobPages.sol)
