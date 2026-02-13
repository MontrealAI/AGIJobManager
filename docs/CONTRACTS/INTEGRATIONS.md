# Integrations

## ENS / NameWrapper ownership checks

Relevant sources:
- [`contracts/utils/ENSOwnership.sol`](../../contracts/utils/ENSOwnership.sol)
- [`contracts/ens/IENSRegistry.sol`](../../contracts/ens/IENSRegistry.sol)
- [`contracts/ens/INameWrapper.sol`](../../contracts/ens/INameWrapper.sol)

**Behavior**: identity checks are used for role eligibility gating where configured.

> Operator note: ENS dependencies are best-effort and may fail due to resolver/wrapper edge-cases.

> Non-goal / limitation: escrow safety and accounting do not depend on ENS hook success.

## ENSJobPages hooks + tokenURI

Relevant sources:
- [`contracts/ens/ENSJobPages.sol`](../../contracts/ens/ENSJobPages.sol)
- [`contracts/ens/IENSJobPages.sol`](../../contracts/ens/IENSJobPages.sol)

- Hook calls are best-effort and tolerate failure (current contract declares `EnsHookAttempted` but does not emit it).
- `setUseEnsJobTokenURI` toggles URI strategy.

> Safety warning: operators must not treat hook success as a settlement or accounting guarantee.

## Merkle allowlists

- Roots configured by owner (`updateMerkleRoots`).
- Callers present proof arrays in `applyForJob`, `validateJob`, `disapproveJob`.
- Additional explicit allowlists (`addAdditionalAgent`, `addAdditionalValidator`) provide emergency/manual overrides.


Detailed operator docs: [`docs/INTEGRATIONS/ENS.md`](../INTEGRATIONS/ENS.md).
