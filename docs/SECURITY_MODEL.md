# Security Model

## Purpose
Threat model and invariant baseline for AGIJobManager.

## Audience
Auditors, security engineers, and operators.

## Preconditions / assumptions
- Centralized business-operated control is explicit design choice.
- No in-place upgrades; redeploy is required for logic changes.

## Threat model summary
### In scope
- Escrow insolvency and accounting mismatches
- Unauthorized state transitions
- Validator incentive manipulation and dispute abuse
- Reentrancy around value-transferring paths
- External-call fragility (ENS hooks, token behavior)

### Out of scope / accepted risks
- Full decentralization of dispute governance
- Trustless validator admission
- Market-level token or NFT price manipulation

## Core invariants
1. **Escrow solvency:** token balance must always cover locked escrow+bonds.
2. **Single settlement effect:** each job settles exactly once (`escrowReleased` and state gating).
3. **Bounded loops:** validator and AGI type loops are hard-bounded.
4. **Controlled withdrawals:** owner can withdraw only computed surplus and only while paused.
5. **Eligibility enforcement:** apply/vote actions require role eligibility + blacklist checks.

## Centralization and privilege risks
- Owner can pause, reconfigure parameters, adjust role lists, and control moderators.
- Moderator resolves disputes and can decide payout direction for disputed jobs.
- Owner can stale-resolve unresolved disputes after timeout.

## Hardening controls present in code
- `nonReentrant` on major state-changing settlement paths.
- Pausable controls and separate settlement pause switch.
- Exact-transfer checks for `transferFrom` token intake (`TransferUtils.safeTransferFromExact`).
- Identity wiring lock (`lockIdentityConfiguration`) for ENS/token/root immutability after launch.

## Known limitations
- ENS hook writes are best-effort and can silently fail except for event trace.
- Deprecated setter `setAdditionalAgentPayoutPercentage` exists but intentionally unusable.
- Security depends on disciplined operational governance (multisig, change control, monitoring).

## Vulnerability reporting
Follow root policy: [`../SECURITY.md`](../SECURITY.md).

## References
- [`../contracts/AGIJobManager.sol`](../contracts/AGIJobManager.sol)
- [`../contracts/ens/ENSJobPages.sol`](../contracts/ens/ENSJobPages.sol)
- [`../contracts/utils/TransferUtils.sol`](../contracts/utils/TransferUtils.sol)
- [`../test/securityRegression.test.js`](../test/securityRegression.test.js)
