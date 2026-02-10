# Architecture

## Scope (what this system is / is not)

`AGIJobManager` is an owner-operated escrow and settlement contract for employer-agent jobs with validator voting, dispute resolution, and ERC-721 completion NFTs. See `contracts/AGIJobManager.sol` (`createJob`, `applyForJob`, `finalizeJob`, `_completeJob`, `_refundEmployer`).

`ENSJobPages` is an optional companion contract used through best-effort hooks to create and maintain ENS-backed job pages. See `contracts/ens/ENSJobPages.sol` (`handleHook`).

Not implemented on-chain in this repo:
- ERC-8004 on-chain protocol logic (off-chain docs/adapters only).
- Upgrade proxy pattern for `AGIJobManager` / `ENSJobPages`.

## High-level architecture

```mermaid
flowchart TD
    Employer -->|createJob + escrow AGI| AJM[AGIJobManager]
    Agent -->|applyForJob + agent bond| AJM
    Validator -->|validate/disapprove + validator bond| AJM
    Moderator -->|resolveDispute / resolveDisputeWithCode| AJM
    Owner -->|admin config / pause / withdraw (paused only)| AJM

    AJM -->|IERC20 transfers| AGI[(AGI token)]
    AJM -->|mint completion NFT| NFT[(ERC-721 job NFT)]
    AJM -->|best-effort hook calls| ENSJP[ENSJobPages]

    ENSJP --> ENS[(ENS Registry)]
    ENSJP --> NW[(NameWrapper)]
    ENSJP --> RES[(Public Resolver)]

    subgraph Off-chain
      UI[UI / indexers / operators]
      Monitoring[Event monitoring + incident response]
    end

    AJM --> UI
    ENSJP --> UI
    AJM --> Monitoring
```

## Components and boundaries

- **AGIJobManager**
  - Holds escrow and all bonds (`lockedEscrow`, `lockedAgentBonds`, `lockedValidatorBonds`, `lockedDisputeBonds`).
  - Performs settlement and payout/refund logic.
  - Enforces role eligibility with either allowlists (`additionalAgents`, `additionalValidators`) or Merkle/ENS ownership checks.
- **ENSJobPages (optional)**
  - Receives hook IDs from `AGIJobManager` and updates ENS pages.
  - Uses best-effort writes for resolver text and authorizations (errors swallowed with `try/catch`).
- **IERC20 token (`agiToken`)**
  - Escrow source, bond transfers, payouts, owner treasury withdrawal constraints.
- **ENS Registry / NameWrapper / Resolver**
  - External dependencies for ownership checks and ENS page updates.
- **Off-chain actors**
  - Employer, agent, validators, moderator(s), owner/operator.

## Trust boundaries and external-call philosophy

1. `AGIJobManager` uses internal accounting to protect escrow solvency before owner withdrawal (`withdrawableAGI`).
2. ENS hook calls from `AGIJobManager` are low-level and best-effort (`_callEnsJobPagesHook`), so settlement logic does not depend on hook success.
3. ENS resolver writes in `ENSJobPages` are also best-effort (`_setTextBestEffort`, `_setAuthorisationBestEffort`).
4. Moderator and owner powers are explicit: owner has broad configuration/pause powers; moderators resolve disputes.
