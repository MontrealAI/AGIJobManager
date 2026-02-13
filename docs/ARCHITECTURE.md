# Architecture

## System architecture

```mermaid
%%{init: {"theme":"base","themeVariables":{"fontFamily":"ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial","background":"#14001F","primaryColor":"#4B1D86","primaryTextColor":"#E9DAFF","lineColor":"#7A3FF2","tertiaryColor":"#1B0B2A","noteBkgColor":"#1B0B2A","noteTextColor":"#E9DAFF"}}}%%
flowchart LR
  Employer -->|createJob/fund| AGIJobManager
  Agent -->|apply/request completion| AGIJobManager
  Validator -->|validate/disapprove + bond| AGIJobManager
  Moderator -->|resolveDisputeWithCode| AGIJobManager
  Owner -->|pause/configure| AGIJobManager
  AGIJobManager <-->|ERC20 transfers| AGIToken
  AGIJobManager <-->|best-effort ownership checks| ENS[ENS + NameWrapper + Resolver]
  AGIJobManager -->|best-effort hooks/tokenURI| ENSJobPages
  AGIJobManager --> Indexers
```

## Repo architecture

```mermaid
flowchart TD
  Root[Repo architecture] --> contracts
  Root --> test
  Root --> forge[forge-test]
  Root --> migrations
  Root --> scripts
  Root --> docs
  Root --> ui
  scripts --> ops[scripts/ops]
  docs --> ref[docs/REFERENCE]
  docs --> contractsDoc[docs/CONTRACTS]
  docs --> runbooks[docs/OPERATIONS]
```

- Text-only wireframe asset: [assets/architecture-wireframe.svg](./assets/architecture-wireframe.svg)
- Generated inventory: [REPO_MAP.md](./REPO_MAP.md)
