# ENSJobPages Contract Reference

## Purpose
`ENSJobPages` manages ENS subnames (`job-<id>.<root>`) and resolver text/auth records for AGI jobs. It is designed as a companion service and is non-critical to core settlement liveness.

## Responsibilities
- Create subname per job (`createJobPage`)
- Set resolver text fields (spec URI/completion URI/status)
- Grant/revoke resolver authorisation for employer/agent
- Lock ENS page and optionally burn NameWrapper fuses
- Provide ENS URI (`ens://job-<id>.<root>`) for completion NFT metadata mode

## Access model
- Admin functions are `onlyOwner`.
- `handleHook(uint8 hook, uint256 jobId)` is `onlyJobManager` and intended for AGIJobManager callbacks.

## Configuration state
- `ens` (`IENSRegistry`)
- `nameWrapper` (`INameWrapper`)
- `publicResolver` (`IPublicResolver`)
- `jobsRootNode` / `jobsRootName`
- `jobManager`
- `useEnsJobTokenURI`

## Hook codes expected from AGIJobManager
- `1`: create page
- `2`: agent assigned
- `3`: completion requested
- `4`: revoke permissions
- `5`: lock ENS (no fuse burn)
- `6`: lock ENS + burn lock fuses when wrapped root is available

## Best-effort behavior
- Resolver text writes and authorisation updates use `try/catch` and do not hard-fail.
- `lockJobENS` emits `JobENSLocked` even if fuse burn cannot be performed.
- AGIJobManager should treat this contract as optional/non-blocking.

## Important methods
- `jobEnsLabel(uint256)`
- `jobEnsName(uint256)`
- `jobEnsURI(uint256)`
- `jobEnsNode(uint256)`
- `createJobPage(uint256,address,string)`
- `onAgentAssigned(uint256,address)`
- `onCompletionRequested(uint256,string)`
- `revokePermissions(uint256,address,address)`
- `lockJobENS(uint256,address,address,bool)`
- `handleHook(uint8,uint256)`

## Operational gotchas
- Contract must control the root in either unwrapped (`ens.owner(root)==this`) or wrapped mode (wrapper owner/approval checks).
- Empty `jobsRootName` causes `jobEnsName`/`jobEnsURI` to revert `ENSNotConfigured`.
- Setting `useEnsJobTokenURI` here only affects returned URI consumption if AGIJobManager also enables its own `setUseEnsJobTokenURI(true)`.
