# ENS Integration

## Scope

AGIJobManager integrates with ENS through an optional helper contract (`ENSJobPages`) using best-effort hooks. Core escrow logic does not depend on ENS success.

## Hook IDs and action mapping

From `AGIJobManager` constants:
- `1`: create page (`ENS_HOOK_CREATE`)
- `2`: assign agent (`ENS_HOOK_ASSIGN`)
- `3`: completion metadata update (`ENS_HOOK_COMPLETION`)
- `4`: revoke permissions (`ENS_HOOK_REVOKE`)
- `5`: lock permissions (`ENS_HOOK_LOCK`)
- `6`: lock + burn child fuses (`ENS_HOOK_LOCK_BURN`)

`AGIJobManager` calls `handleHook(uint8 hook, uint256 jobId)` on ENSJobPages with fixed gas and emits `EnsHookAttempted(..., success)`.

## Best-effort behavior

- Hook call failures do not revert job lifecycle actions.
- ENS URI reads for NFT minting are optional; manager falls back to completion URI when ENS lookup fails/empty.
- Operationally, ENS should be treated as a mirrored metadata layer, not an economic dependency.

## Wrapped vs unwrapped root handling

`ENSJobPages._createSubname` branches:
- **Wrapped root**: uses `nameWrapper.setSubnodeRecord`, requiring wrapper ownership or operator approval.
- **Unwrapped root**: uses `ens.setSubnodeRecord`, requiring direct ENS ownership by ENSJobPages contract.

## Fuse-locking and permissions model

- On create: employer is authorized on resolver + spec text written.
- On assign: assigned agent authorization set.
- On completion: completion text updated.
- On revoke/lock: employer and agent authorization revoked.
- On hook `6`: if root is wrapped, `setChildFuses` attempts to burn `CANNOT_SET_RESOLVER | CANNOT_SET_TTL` with max expiry.

`AGIJobManager.lockJobENS(jobId, burnFuses)` is permissionless for terminal jobs, but fuse burning is owner-only.

## Deployment and configuration sequence (mainnet)

1. Deploy `ENSJobPages` with ENS Registry, PublicResolver, optional NameWrapper, `jobsRootNode`, and `jobsRootName`.
2. Ensure root authority before enabling hooks:
   - Unwrapped root: `ENS.owner(jobsRootNode) == ENSJobPages`.
   - Wrapped root: `ENS.owner(jobsRootNode) == NameWrapper` and `ownerOf(uint256(jobsRootNode))` is `ENSJobPages` or has approved it with `setApprovalForAll`.
3. Call `ENSJobPages.setJobManager(AGIJobManager)`.
4. Call `AGIJobManager.setEnsJobPages(ENSJobPages)`.
5. Optionally enable NFT URI override through `AGIJobManager.setUseEnsJobTokenURI(true)`.
6. Optionally call `ENSJobPages.lockConfiguration()` to freeze ENS endpoints/root/job-manager wiring and avoid accidental drift.

> Note: `ENSJobPages.setUseEnsJobTokenURI(...)` is local helper state only; AGIJobManager tokenURI override is controlled by `AGIJobManager.setUseEnsJobTokenURI(...)`.

Resolver `setText`/`setAuthorisation` writes are intentionally best-effort (try/catch). Large text payloads may exceed hook gas and should be retried directly by authorised actors.

## Hook execution sequence

```mermaid
sequenceDiagram
    participant AJM as AGIJobManager
    participant ENSJP as ENSJobPages
    participant ENS as ENS/Wrapper/Resolver

    AJM->>ENSJP: handleHook(1, jobId)
    ENSJP->>ENS: create subname + set schema/spec (best-effort text)

    AJM->>ENSJP: handleHook(2, jobId)
    ENSJP->>ENS: authorize agent (best-effort)

    AJM->>ENSJP: handleHook(3, jobId)
    ENSJP->>ENS: set completion text (best-effort)

    AJM->>ENSJP: handleHook(4, jobId)
    ENSJP->>ENS: revoke employer/agent permissions (best-effort)

    AJM->>ENSJP: handleHook(5 or 6, jobId)
    ENSJP->>ENS: lock permissions; optional fuse burn for wrapped roots
```

## Troubleshooting matrix

| Symptom | Likely cause | Verify | Remediation |
|---|---|---|---|
| `EnsHookAttempted success=false` events | ENSJobPages address wrong or reverting | Check `ensJobPages` address and code size; inspect ENSJobPages logs | Set correct ENSJobPages or disable by setting zero address |
| Job settles but ENS records missing | Best-effort resolver writes failed | Query resolver text/authorisation for job node | Replay via owner `ENSJobPages` admin functions if needed |
| Fuse burn not applied | Root not wrapped or authorization missing | Check ENS owner(root) and NameWrapper ownership/approval | Correct wrapper ownership/approval, then retry lock with burn |
| `ENSNotAuthorized` in ENSJobPages direct calls | Contract lacks root authority | Verify root owner in ENS/NameWrapper | Transfer ownership or approve ENSJobPages operator |
| NFT tokenURI is completion URI instead of `ens://` | `useEnsJobTokenURI` disabled or ENS URI empty/failing | Check manager `setUseEnsJobTokenURI` state and ENSJP `jobEnsURI` | Enable flag and ensure ENSJobPages reachable/configured |
