# ENS and Companion Interfaces

## IENSRegistry (`contracts/ens/IENSRegistry.sol`)
Used by `ENSJobPages` to read ownership/resolver and create subnode records in unwrapped mode.

Methods:
- `owner(bytes32 node)`
- `resolver(bytes32 node)`
- `setSubnodeRecord(bytes32 node, bytes32 label, address owner, address resolver, uint64 ttl)`

## IPublicResolver (`contracts/ens/IPublicResolver.sol`)
Used by `ENSJobPages` for resolver authorization and metadata text records.

Methods:
- `setAuthorisation(bytes32 node, address target, bool isAuthorised)`
- `setText(bytes32 node, string key, string value)`

## INameWrapper (`contracts/ens/INameWrapper.sol`)
Used in wrapped ENS mode by `ENSJobPages` for ownership checks, subnode creation, and fuse operations.

Methods:
- `ownerOf(uint256 id)`
- `isApprovedForAll(address owner, address operator)`
- `isWrapped(bytes32 node)`
- `setChildFuses(bytes32 parentNode, bytes32 labelhash, uint32 fuses, uint64 expiry)`
- `setSubnodeRecord(...)`

## IENSJobPages (`contracts/ens/IENSJobPages.sol`)
Used by AGIJobManager for optional ENS hooks and URI lookup.

Methods:
- `createJobPage`
- `handleHook`
- `onAgentAssigned`
- `onCompletionRequested`
- `revokePermissions`
- `lockJobENS`
- `jobEnsName`
- `jobEnsURI`
- `setUseEnsJobTokenURI`

## Integration notes
- AGIJobManager performs low-level best-effort hook calls with bounded gas.
- ENS failures should not be treated as escrow-settlement failures.
