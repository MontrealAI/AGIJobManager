# ENS and Related Interfaces

## Purpose
Document external interface assumptions for ENS integrations and ownership checks.

## Audience
Integrators and auditors.

## Interfaces
| Interface | Used by | Assumed behavior |
|---|---|---|
| `IENSRegistry` | `ENSJobPages` | Correct `owner`, `resolver`, and subnode record setting |
| `IPublicResolver` | `ENSJobPages` | Supports `setAuthorisation` and `setText` |
| `INameWrapper` | `ENSJobPages` | `isWrapped`, `ownerOf`, approval checks, fused subnode operations |
| lightweight `ENS`/`NameWrapper` in AGIJobManager | `AGIJobManager` | Resolver/wrapper ownership is queryable for role gating |

## Operational Assumptions
- ENS records may be unwrapped or wrapped; both paths are handled.
- Resolver may be missing/incompatible; this should degrade metadata features, not escrow accounting.
- NameWrapper fuse burning is irreversible.

## Gotchas
- Interface compatibility is runtime-enforced; misconfigured addresses can cause hook failures and failed ownership checks.
- Root wiring updates become impossible after `lockIdentityConfiguration()`.

## References
- [`../../contracts/ens/IENSRegistry.sol`](../../contracts/ens/IENSRegistry.sol)
- [`../../contracts/ens/IPublicResolver.sol`](../../contracts/ens/IPublicResolver.sol)
- [`../../contracts/ens/INameWrapper.sol`](../../contracts/ens/INameWrapper.sol)
- [`../../contracts/ens/IENSJobPages.sol`](../../contracts/ens/IENSJobPages.sol)
