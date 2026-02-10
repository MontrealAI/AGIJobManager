# ENS Interface Reference

## `IENSRegistry`
Used by `ENSJobPages` to:
- read `owner(node)` and `resolver(node)`
- create subnode records via `setSubnodeRecord`

## `IPublicResolver`
Used by `ENSJobPages` for best-effort metadata/permissions:
- `setAuthorisation(node,target,isAuthorised)`
- `setText(node,key,value)`

## `INameWrapper`
Used by `ENSJobPages` for wrapped-root operations:
- `ownerOf(id)` and `isApprovedForAll`
- `isWrapped(node)`
- `setChildFuses` and wrapped `setSubnodeRecord`

## Integration notes
- AGIJobManager itself depends on lightweight ENS/NameWrapper interfaces for gating and identity checks.
- ENS integration is optional at runtime (`ensJobPages` can be zero address).
- Hook failures should be treated as metadata-plane failures, not escrow-plane failures.
