# Trust model and security overview — v1.0.0

AGIJobManager is an owner-operated USDC escrow system. The contract enforces accounting and lifecycle guards; participants still trust owner/moderator decisions, validator judgment, issuer behavior and the configured identity systems. This release is internally qualified, not independently audited.

## Owner authority

The owner can pause intake or settlement, manage eligibility and moderators, propose ownership transfer and update supported parameters under their guards. USDC and the 30%/10% successful-job shares cannot change. Wallet rotation requires paused intake and all four job escrow/bond reserves empty; ownership requires acceptance by the proposed owner. Code is non-upgradeable.

The validator budget is 1–60%, fixed per job at posting. Agent bonds are fixed at assignment; validator bond size is fixed at the first vote. Some owner changes therefore affect later actions on already posted jobs. Review/challenge periods, quorum, thresholds and slashing changes require all live job escrow and bonds empty. See [owner controls](OWNER_CONTROLS.md) and [configuration](CONFIGURATION.md).

## Accounting

`withdrawableUSDC()` is the USDC balance minus `lockedEscrow`, `lockedAgentBonds`, `lockedValidatorBonds`, `lockedDisputeBonds` and `lockedClaims`; it reverts if reserves exceed balance. A withdrawal requires owner authority, paused intake, enabled settlement and an amount no greater than that surplus.

Example: balance 1,000 USDC minus 700 escrow, 50 total bonds and 100 pending claims leaves 150 withdrawable. A 150 withdrawal can succeed under the required pause state; 200 must revert. Successful jobs distribute their entire original cost, including any unused validator allocation and rounding remainder. Direct unreserved donations can create surplus. There is no `contributeToRewardPool` API in this release.

## Pause semantics

| Control state | Job creation/assignment | Completion, votes, disputes, settlement/refunds | Reads |
| --- | --- | --- | --- |
| Both flags false | Allowed under normal guards | Allowed under normal guards | Available |
| Intake paused; settlement enabled | Blocked | Allowed under normal guards | Available |
| Settlement paused, regardless of intake flag | Blocked | Blocked | Available |

`pauseAll()` sets both flags. Block timestamps continue, but settlement pauses stop lifecycle clocks and extend deadlines by the paused time. Intake-only pauses do not extend deadlines. Claim retries are unavailable while settlement is paused. Recover settlement with intake still paused before deciding to admit new jobs. See [incident response](OPERATIONS/INCIDENT_RESPONSE.md).

## Identity lock

`lockIdentityConfiguration()` permanently freezes the guarded ENS registry, NameWrapper, root-node and ENSJobPages-pointer setters. It does not lock Merkle roots, direct role lists, moderators, ordinary policy settings or ownership. USDC was already immutable at construction.

Registry/wrapper/root updates require empty escrow and bond reserves. The ENSJobPages pointer has its own code-address and identity-lock checks. Never apply an irreversible lock to repair a suspected bad configuration. Optional ENS hooks do not override job settlement outcomes.

## Residual operational risks

- USDC issuer pause or blocklisting can delay receipt of funds. Failed outgoing transfers become reserved claims; other eligible recipients can still be paid. Incoming transfers remain strict and atomic.
- No-vote finalization opens a dispute without paying the agent. Explicit buyer acceptance can authorize immediate payment and earns no reputation.
- Moderators resolve active disputes; the owner can resolve stale disputes after the configured period. These are trusted decisions.
- Incorrect validator bonds can be slashed. Correct-side validators can receive rewards and reputation according to the outcome; reputation is not an independent work-quality certificate.
- Metadata may be unavailable, misleading or unsafe to open. A completion NFT is a receipt, not a guarantee of content or value.

Read [mainnet readiness](MAINNET_READINESS.md), [security model](SECURITY_MODEL.md) and the source-specific release evidence before activation.
