# Architecture

## System component flow

```mermaid
%%{init: {"theme":"base","themeVariables":{"fontFamily":"ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial","background":"#14001F","primaryColor":"#4B1D86","primaryTextColor":"#E9DAFF","lineColor":"#7A3FF2","tertiaryColor":"#1B0B2A","noteBkgColor":"#1B0B2A","noteTextColor":"#E9DAFF"}}}%%
flowchart LR
    Owner[Owner/Operator] --> AGI[AGIJobManager]
    Employer --> AGI
    Agent --> AGI
    Validator --> AGI
    Moderator --> AGI
    AGI --> Token[(AGI ERC20)]
    AGI -. best-effort .-> ENS[(ENS Registry + NameWrapper)]
    AGI -. best-effort .-> Pages[(ENSJobPages)]
    Offchain[Monitoring/Indexer] --> AGI
```

## Repository architecture flow

```mermaid
flowchart TB
    C[contracts/] --> A[AGIJobManager.sol]
    T[test/] --> A
    M[migrations/] --> A
    S[scripts/] --> D[docs generators/checks]
    D --> Docs[docs/]
    CI[.github/workflows/docs.yml] --> S
```

- Text-only visual assets: [palette.svg](./assets/palette.svg), [architecture-wireframe.svg](./assets/architecture-wireframe.svg)
