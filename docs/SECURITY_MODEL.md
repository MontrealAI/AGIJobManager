# Security Model

## Threat model summary
- This is a centralized, owner-operated escrow protocol.
- Moderators are trusted dispute resolvers.
- Validators are permissioned and economically incentivized, not trustless jurors.
- ENS integrations are ancillary; escrow safety must not depend on ENS liveness.

## Safety properties
- **Escrow solvency invariant**: contract AGI balance must cover all locked amounts.
- **Single-release accounting**: escrow/bonds are released through dedicated settlement helpers and should not be double-released.
- **Bounded loops**: validator and AGIType loops are bounded by hard caps.
- **Reentrancy protection**: high-risk token-moving lifecycle/settlement entrypoints are guarded with `nonReentrant`; coverage is function-specific (not blanket across every state-mutating admin function).

## Centralization assumptions
- Owner can pause, tune parameters, alter allowlists, and manage moderators.
- Owner stale-dispute resolution is available after dispute timeout.
- Production operations should use multisig ownership and documented change controls.

## Known limitations / non-goals
- No internal NFT marketplace.
- No on-chain decentralized court.
- ENS hooks are best-effort metadata operations.
- Contract is non-upgradeable in-place; major logic changes require redeploy and migration planning.

## Vulnerability reporting
Follow the repository security policy: [`../SECURITY.md`](../SECURITY.md).
