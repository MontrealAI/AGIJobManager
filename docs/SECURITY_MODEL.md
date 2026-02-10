# Security Model

## Purpose
Summarize threat model, assumptions, invariants, and known limits.

## Audience
Auditors, maintainers, and operators.

## Threat Model Summary
### In scope
- Escrow theft or unintended release
- Bond accounting errors
- Settlement liveness failure
- Privileged misuse / key compromise
- ENS integration failures impacting metadata

### Assumptions
- Owner and moderators are trusted operational roles.
- AGI ERC20 behaves compatibly with exact transfer checks.
- Off-chain URI hosting and indexing are external trust dependencies.

## Core Invariants
- Solvency: contract AGI balance must cover all locked pools before any owner withdrawal.
- Settlement preconditions: completion must be requested before finalize/dispute paths settle.
- Bounded loops: validator loop capped by `MAX_VALIDATORS_PER_JOB`, AGI type scan capped by `MAX_AGI_TYPES`.
- Non-reentrancy: external state-changing workflows use `nonReentrant`.

## Centralization Risks
- Owner can reconfigure many economic and access parameters.
- Moderators decide disputed outcomes.
- Validator set is permissioned even when bonds are posted.

## Known Limitations / Non-goals
- No trustless governance or decentralized court.
- No internal NFT marketplace.
- ENS metadata hooks are best-effort only.

## Audit Posture
- Repository marks software as experimental; no bundled public audit report.
- Follow [`../SECURITY.md`](../SECURITY.md) for disclosure process.

## Gotchas
- `lockIdentityConfiguration` is not a full governance lock.
- `resolveDispute` string mode is deprecated; typed code path is preferred.

## References
- [`../contracts/AGIJobManager.sol`](../contracts/AGIJobManager.sol)
- [`../SECURITY.md`](../SECURITY.md)
- [`../test/securityRegression.test.js`](../test/securityRegression.test.js)
