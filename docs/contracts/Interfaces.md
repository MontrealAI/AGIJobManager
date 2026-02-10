# Interfaces and External Assumptions

## Purpose
Define minimal ENS-related external interfaces and trust assumptions used by this repo.

## Audience
Auditors and deploy operators.

## Preconditions / assumptions
- Interface contracts are intentionally minimal and only include methods consumed by this codebase.

## Interface summary
| Interface | Methods used | Assumptions |
|---|---|---|
| `IENSRegistry` | `owner`, `resolver`, `setSubnodeRecord` | Registry is canonical for target network. |
| `INameWrapper` | `ownerOf`, `isApprovedForAll`, `isWrapped`, `setChildFuses`, `setSubnodeRecord` | Root may be wrapped; wrapper permissions must be granted when applicable. |
| `IPublicResolver` | `setAuthorisation`, `setText` | Resolver supports expected text/auth APIs. |
| `IENSJobPages` | lifecycle hook methods and URI getters | AGIJobManager treats calls as best-effort side effects. |

## Ownership verification model
`AGIJobManager` eligibility checks can pass by:
1. explicit additional allowlist,
2. valid Merkle proof,
3. ENS ownership check (`ENSOwnership.verifyENSOwnership`) using NameWrapper owner or resolver `addr`.

## Failure behavior
- ENS integration failures should not compromise escrow state machine.
- ENS configuration mismatch manifests as failed eligibility or unsuccessful hook attempts/events.

## Gotchas / failure modes
- Resolver-based ownership requires resolver configured on subnode.
- Wrapped roots require either direct ownership by ENSJobPages or `isApprovedForAll` authorization.

## References
- [`../../contracts/ens/IENSRegistry.sol`](../../contracts/ens/IENSRegistry.sol)
- [`../../contracts/ens/INameWrapper.sol`](../../contracts/ens/INameWrapper.sol)
- [`../../contracts/ens/IPublicResolver.sol`](../../contracts/ens/IPublicResolver.sol)
- [`../../contracts/ens/IENSJobPages.sol`](../../contracts/ens/IENSJobPages.sol)
- [`../../contracts/utils/ENSOwnership.sol`](../../contracts/utils/ENSOwnership.sol)
