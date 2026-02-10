# Architecture

## Purpose
Describe protocol boundaries, trust model, and major runtime components.

## Audience
Engineers, auditors, operators.

## Preconditions
- Understand this is an owner-operated escrow design (not a trustless DAO court).

## System Overview
`AGIJobManager` enforces job escrow lifecycle on-chain: create → assign → completion request → validator voting / dispute → settlement and completion NFT issuance. ENS integration is optional and best-effort through `ensJobPages` hooks.

```mermaid
flowchart TD
  subgraph OffChain[Off-chain components]
    UI[Client / UI / Bots]
    IDX[Indexers / Monitoring]
    GOV[Ops Governance
(change windows, approvals)]
  end

  subgraph OnChain[On-chain components]
    JM[AGIJobManager]
    ENSP[ENSJobPages optional]
    AGI[(AGI ERC20)]
    ENSR[(ENS Registry)]
    WRAP[(NameWrapper)]
    RES[(Public Resolver)]
    NFT[(ERC721 completion NFTs)]
  end

  UI --> JM
  IDX --> JM
  GOV --> JM
  JM <--> AGI
  JM --> NFT
  JM -. hook calls .-> ENSP
  ENSP <--> ENSR
  ENSP <--> WRAP
  ENSP <--> RES
```

**Legend**: solid lines are required protocol paths; dashed line is optional metadata integration.

## Trust Model
- Owner can pause/unpause, alter parameters, manage allowlists/blacklists, assign moderators, and withdraw only surplus AGI while paused.
- Moderators resolve disputes (`resolveDispute*`).
- Validators are permissioned by additional allowlist OR Merkle OR ENS ownership checks.
- ENS hooks are best-effort and intentionally non-blocking for escrow settlement.

## On-chain vs Off-chain Boundaries
| Domain | On-chain | Off-chain |
|---|---|---|
| Escrow custody | AGI transfer + locked accounting | Treasury policy / approvals |
| Role eligibility | Merkle roots + ENS ownership checks + extra allowlists | Root list generation and governance |
| Job metadata | URIs stored on-chain | JSON hosting, content pinning, privacy controls |
| Monitoring | Events and view getters | Alerting, dashboards, incident handling |

## Failure Modes / Gotchas
- `lockIdentityConfiguration()` freezes token/ENS/root wiring permanently, but does not freeze economic or moderation controls.
- `pause()` and `settlementPaused` are independent controls; misuse can halt intended exits.
- Under-quorum or tie results in dispute path, not silent settlement.

## References
- [`contracts/AGIJobManager.sol`](../contracts/AGIJobManager.sol)
- [`contracts/ens/ENSJobPages.sol`](../contracts/ens/ENSJobPages.sol)
