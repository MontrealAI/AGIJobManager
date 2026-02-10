# Contracts Overview

## Primary contracts
- `contracts/AGIJobManager.sol` — core escrow and lifecycle engine.
- `contracts/ens/ENSJobPages.sol` — optional ENS job page manager.

## Supporting libraries
- `contracts/utils/UriUtils.sol`
- `contracts/utils/TransferUtils.sol`
- `contracts/utils/BondMath.sol`
- `contracts/utils/ReputationMath.sol`
- `contracts/utils/ENSOwnership.sol`

## External-facing interfaces
- `contracts/ens/IENSRegistry.sol`
- `contracts/ens/IPublicResolver.sol`
- `contracts/ens/INameWrapper.sol`
- `contracts/ens/IENSJobPages.sol`

## End-to-end workflow: job lifecycle

```mermaid
sequenceDiagram
  participant E as Employer
  participant M as AGIJobManager
  participant A as Agent
  participant V as Validators
  participant ENS as ENSJobPages

  E->>M: createJob(specURI,payout,duration,details)
  M->>ENS: hook create (best effort)
  A->>M: applyForJob(jobId,subdomain,proof) + agent bond
  M->>ENS: hook assign (best effort)
  A->>M: requestJobCompletion(jobId,completionURI)
  M->>ENS: hook completion (best effort)
  V->>M: validateJob/disapproveJob + validator bond
  M->>M: finalizeJob()
  alt Agent wins
    M->>A: payout + bond return
    M->>V: validator settlements
    M->>E: ERC-721 completion NFT
  else Employer wins
    M->>E: refund
    M->>V: validator settlements
  end
  M->>ENS: hook revoke (best effort)
```

## End-to-end workflow: disputes

```mermaid
sequenceDiagram
  participant U as Employer/Agent
  participant M as AGIJobManager
  participant Mod as Moderator
  participant Own as Owner

  U->>M: disputeJob(jobId) + dispute bond
  Mod->>M: resolveDisputeWithCode(jobId, code, reason)
  alt code=1 agent win
    M->>M: _completeJob()
  else code=2 employer win
    M->>M: _refundEmployer()
  else code=0 no-action
    M-->>U: dispute remains active
  end
  Own->>M: resolveStaleDispute(jobId, employerWins) (after timeout)
```

## ENS hooks and NFT URI behavior
- AGIJobManager emits low-level best-effort calls (`handleHook`) to ENSJobPages for create/assign/completion/revoke/lock flows.
- If `useEnsJobTokenURI=true` and ENSJobPages returns a non-empty URI, completion NFTs use that URI; otherwise job completion URI is used.

## Next references
- [AGIJobManager contract reference](./contracts/AGIJobManager.md)
- [ENSJobPages contract reference](./contracts/ENSJobPages.md)
- [Utilities](./contracts/Utilities.md)
- [Interfaces](./contracts/Interfaces.md)
