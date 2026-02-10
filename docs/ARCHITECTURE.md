# Architecture

## Scope
AGIJobManager is an owner-operated escrow and settlement contract with validator voting, dispute moderation, ENS hook integration, and ERC-721 job NFT minting. It is **not** an upgradeable proxy system and **not** an on-chain ERC-8004 implementation.

## High-level architecture

```mermaid
flowchart TD
  subgraph On-chain
    A[AGIJobManager]
    B[AGI ERC20]
    C[ENSJobPages]
    D[ENS Registry]
    E[NameWrapper]
    F[Public Resolver]
    G[ERC721 Job NFTs]
  end

  subgraph Off-chain
    H[Owner / Moderators]
    I[Employers]
    J[Agents]
    K[Validators]
    L[Indexers + Monitoring]
  end

  I -->|createJob + escrow transfer| A
  J -->|apply/request completion| A
  K -->|validate/disapprove + bond| A
  H -->|config, dispute resolution, pause| A
  A -->|IERC20 transfers| B
  A -->|handleHook(uint8,uint256)| C
  C --> D
  C --> E
  C --> F
  A -->|mint completion NFT| G
  A -->|events| L
```

## Components
- **AGIJobManager (`contracts/AGIJobManager.sol`)**: core state machine, escrow accounting (`lockedEscrow` + bond ledgers), role gating (owner/moderator/allowlists + ENS/Merkle), and settlement.
- **ENSJobPages (`contracts/ens/ENSJobPages.sol`)**: hook target for job-page name creation, resolver text updates, auth grants/revokes, and optional fuse burning on wrapped roots.
- **Token (`IERC20`)**: external AGI token used for escrow and bonds (`agiToken`).
- **ENS Registry / NameWrapper / Resolver**: ownership checks and namespace management used by role verification and job page updates.
- **Off-chain actors**: employers/agents/validators/moderators/owner plus indexers/alerting consuming events.

## Trust boundaries and external-call philosophy
- **Owner trust boundary**: owner can pause, configure parameters, manage allowlists/blacklists, and lock identity wiring.
- **Moderator trust boundary**: moderators can resolve disputes.
- **Best-effort ENS hooks**: AGIJobManager emits `EnsHookAttempted` and continues even if hook calls fail.
- **Best-effort ENS resolver writes in ENSJobPages**: `setText`/`setAuthorisation`/`setChildFuses` are wrapped in `try/catch`; operation may partially succeed.
- **Escrow solvency boundary**: `withdrawableAGI()` reverts on insolvency (`InsolventEscrowBalance`) and `withdrawAGI()` is owner-only, paused-only, and limited to non-locked funds.
