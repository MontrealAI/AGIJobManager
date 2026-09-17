# Trust model and security overview — v0.9.1

AGIJobManager is an owner-operated USDC escrow system. The contract enforces accounting and lifecycle guards; participants still trust owner/moderator decisions, validator judgment, issuer behavior and the configured identity systems. This release is internally qualified, not independently audited.

## Owner authority

The owner can pause intake or settlement, manage eligibility and moderators, propose ownership transfer and update supported parameters under their guards. USDC and the 30%/10% successful-job shares cannot change. Wallet rotation requires paused intake and all four reserves empty; ownership requires acceptance by the proposed owner. Code is non-upgradeable.

The validator budget is 1–60%, fixed per job at posting. Agent bonds are fixed at assignment; validator bond size is fixed at the first vote. Some owner changes therefore affect later actions on already posted jobs. Review/challenge periods, quorum, thresholds and slashing changes require all reserves empty. See [owner controls](OWNER_CONTROLS.md) and [configuration](CONFIGURATION.md).

## Accounting

`withdrawableUSDC()` is the USDC balance minus `lockedEscrow`, `lockedAgentBonds`, `lockedValidatorBonds` and `lockedDisputeBonds`; it reverts if reserves exceed balance. A withdrawal requires owner authority, paused intake, enabled settlement and an amount no greater than that surplus.

Example: balance 1,000 USDC minus 700 escrow and 50 total bonds leaves 250 withdrawable. A 250 withdrawal can succeed under the required pause state; 300 must revert. Successful jobs distribute their entire original cost, including any unused validator allocation and rounding remainder. Direct unreserved donations can create surplus. There is no `contributeToRewardPool` API in this release.

## Pause semantics

| Control state | Job creation/assignment | Completion, votes, disputes, settlement/refunds | Reads |
| --- | --- | --- | --- |
| Both flags false | Allowed under normal guards | Allowed under normal guards | Available |
| Intake paused; settlement enabled | Blocked | Allowed under normal guards | Available |
| Settlement paused, regardless of intake flag | Blocked | Blocked | Available |

`pauseAll()` sets both flags. Pauses do not stop timestamps or extend deadlines. Recover settlement with intake still paused before deciding to admit new jobs. See [incident response](OPERATIONS/INCIDENT_RESPONSE.md).

## Identity lock

`lockIdentityConfiguration()` permanently freezes the guarded ENS registry, NameWrapper, root-node and ENSJobPages-pointer setters. It does not lock Merkle roots, direct role lists, moderators, ordinary policy settings or ownership. USDC was already immutable at construction.

Registry/wrapper/root updates require empty escrow and bond reserves. The ENSJobPages pointer has its own code-address and identity-lock checks. Never apply an irreversible lock to repair a suspected bad configuration. Optional ENS hooks do not override job settlement outcomes.

## Residual operational risks

- USDC issuer pause or blocklisting can stop settlement or refunds; an atomic revert preserves state, but no completion time can be promised until the restriction is resolved.
- A no-vote job can finalize for the agent after review expires. It earns no reputation through that fallback and is not independently validated work.
- Moderators resolve active disputes; the owner can resolve stale disputes after the configured period. These are trusted decisions.
- Incorrect validator bonds can be slashed. Correct-side validators can receive rewards and reputation according to the outcome; reputation is not an independent work-quality certificate.
- Metadata may be unavailable, misleading or unsafe to open. A completion NFT is a receipt, not a guarantee of content or value.

Read [mainnet readiness](MAINNET_READINESS.md), [security model](SECURITY_MODEL.md) and the source-specific release evidence before activation.
