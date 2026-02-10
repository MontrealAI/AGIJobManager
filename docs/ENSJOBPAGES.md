# ENSJobPages Integration

## Integration model
`AGIJobManager` calls `ENSJobPages.handleHook(hook,jobId)` in best-effort mode; failures do not revert AGIJobManager settlement/lifecycle logic. `ENSJobPages` then reads job data via `IAGIJobManagerView` and applies ENS updates.

## Hook map

| Hook id | Meaning | ENSJobPages action |
|---:|---|---|
| `1` | Create | create job subname, authorize employer, set `schema` + `agijobs.spec.public` text |
| `2` | Assign | authorize agent on job node |
| `3` | Completion | set `agijobs.completion.public` text |
| `4` | Revoke | revoke employer/agent authorizations |
| `5` | Lock | revoke authorizations + emit lock event (no fuse burn) |
| `6` | Lock + burn | same as 5 plus wrapped-root `setChildFuses` attempt |

```mermaid
sequenceDiagram
  participant M as AGIJobManager
  participant E as ENSJobPages
  participant R as ENS Registry/NameWrapper/Resolver

  M->>E: handleHook(1, jobId)
  E->>R: create subname + set text + authorize employer
  M->>E: handleHook(2, jobId)
  E->>R: authorize agent
  M->>E: handleHook(3, jobId)
  E->>R: set completion text
  M->>E: handleHook(4,5,6, jobId)
  E->>R: revoke auth; optionally burn fuses when wrapped
```

## Wrapped vs unwrapped root behavior
- `_isWrappedRoot()` is true when `nameWrapper` is set and `ens.owner(jobsRootNode) == address(nameWrapper)`.
- Wrapped root creation path uses `nameWrapper.setSubnodeRecord(...)` and requires wrapper authorization (`ownerOf(rootNode)` or `isApprovedForAll`).
- Unwrapped root path uses `ens.setSubnodeRecord(...)` and requires this contract to directly own `jobsRootNode`.

## Fuse locking/burning semantics
- `LOCK_FUSES = CANNOT_SET_RESOLVER | CANNOT_SET_TTL`.
- Fuse burn is attempted only when `burnFuses==true` and root is wrapped.
- If fuse burn fails, call does not revert; event `JobENSLocked(..., fusesBurned=false)` records the outcome.
- “Locked” in this contract means employer/agent resolver authorization is revoked; it does **not** guarantee fuse burn unless explicitly successful.

## Operational prerequisites
- `ENSJobPages` must have valid `ens`, `publicResolver`, non-zero `jobsRootNode`, and configured `jobManager`.
- For wrapped roots, configure wrapper ownership/approval before live hooks.
- For AGIJobManager integration, set `setEnsJobPages(address)` and optionally `setUseEnsJobTokenURI(true)` if NFT metadata should resolve to `ens://job-<id>.<root>`.
