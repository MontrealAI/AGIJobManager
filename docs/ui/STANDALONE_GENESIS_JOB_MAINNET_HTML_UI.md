# Standalone HTML UI Artifact: `agijobmanager_genesis_job_mainnet_2026-03-05-v21.html`

This page documents the standalone, versioned HTML interface artifact at:

- `ui/agijobmanager_genesis_job_mainnet_2026-03-05-v21.html`

## What this page is

- A **single-file browser UI artifact** with embedded styles and JavaScript.
- A **mainnet-targeted operational interface** with read and write flows for the deployed AGIJobManager environment.
- An **additive artifact** in this repository. It does **not** replace the broader Next.js UI effort in `ui/` and `docs/ui/`.

## What this page is for

Grounded in the file contents, this page is built to:

- Connect an injected wallet (`window.ethereum`) and read live protocol data.
- Present role-guided workflows (Employer, Agent, Validator).
- Execute on-chain job lifecycle transactions (create/apply/review/dispute/finalize paths).
- Verify ENS role ownership signals and show ENSJobPages-related state.
- Support job spec/completion URI preparation, normalization, and IPFS-oriented metadata checks.
- Show completion NFT-related context and outbound links (for example Etherscan tx links).
- Provide an embedded deBridge route panel and an AGIALPHA conversion console tied to hardcoded mainnet addresses.

## Intended audience

Use this page if you need a browser-only, version-pinned interface for:

- Mainnet demonstrations and operational walkthroughs.
- Contract owner/operator live checks.
- Employer/agent/validator interaction with deployed contracts.
- Review of job metadata/completion URI quality before submitting transactions.

## Network and contract assumptions (embedded in the artifact)

This artifact hardcodes Ethereum mainnet assumptions and specific addresses in the page source.

- AGIJobManager: `0xB3AAeb69b630f0299791679c063d68d6687481d1`
- ENSJobPages: `0xc19A84D10ed28c2642EfDA532eC7f3dD88E5ed94`
- NameWrapper: `0xD4416b13d2b3a9aBae7AcD5D6C2BbDBE25686401`
- Bridged AGIALPHA token: `0x2e8Fb54C3eC41F55F06C1F082C081a609EaA4ebe`
- Official AGIALPHA token: `0xa61a3b3a130a9c20768eebf97e21515a6046a1fa`
- AGIALPHAEqualMinterVault: `0x27d6fe8668c6f652ac26ffae020d949f03af80d8`

Write actions are gated by both:

- Ethereum mainnet (`chainId = 1`), and
- local Terms acceptance toggle in the page.

## What this page does not replace

- It does **not** replace Hardhat deployment and verification runbooks.
- It does **not** replace ENSJobPages replacement procedures.
- It does **not** replace the broader full UI roadmap and application architecture documented in `docs/ui/`.

For canonical deployment/operator paths, keep using:

- `hardhat/README.md` (official path)
- `docs/DEPLOYMENT/ENS_JOB_PAGES_MAINNET_REPLACEMENT.md` (ENS replacement flow)

## Quick start (operator-safe)

### Preconditions

- Modern browser with an injected EVM wallet extension.
- Wallet account available on Ethereum mainnet.
- Ability to verify target contracts before signing.

### Open the page

Option A (recommended): serve from local HTTP.

```bash
cd /workspace/AGIJobManager
python3 -m http.server 8080
```

Then open:

- `http://localhost:8080/ui/agijobmanager_genesis_job_mainnet_2026-03-05-v21.html`

Option B: open directly as a local file in a browser.

- This may still work for many flows, but browser/extension policies can vary by environment.

### Minimal usage flow

1. Click **Connect wallet**.
2. Confirm wallet is on **Ethereum Mainnet**.
3. Read and accept the embedded Terms in the page.
4. Use **Refresh** / jobs table / role sections to inspect live state.
5. Before any write action, verify transaction details in the page review modal and in your wallet.

Expected result:

- Read views populate from live contracts.
- Write buttons unlock only on mainnet after Terms acceptance.

## Safety and trust notes

- This is a static client artifact; it is not the protocol itself.
- AGIJobManager and ENSJobPages contracts remain the source of truth.
- Always verify network + contract addresses before signing any transaction.
- ENS behavior is additive/best-effort relative to core settlement behavior.
- The page stores local UI state (including activity log and optional IPFS settings) in browser localStorage.
  - Do not store sensitive credentials on shared/untrusted machines.

## Relationship to ENSJobPages and AGIJobManager

In plain terms:

- AGIJobManager drives job state, escrow, settlement, and role-gated write outcomes.
- ENSJobPages is an identity/presentation layer used by this UI for ENS-related checks/previews and naming context.
- The UI reflects and submits to deployed contracts; it does not supersede protocol invariants.
- ENS-related updates can be informative and operationally useful while remaining separate from core settlement correctness.

## Troubleshooting (page-specific)

- **Wallet not detected (`Please install MetaMask`)**
  - Install/enable an injected wallet and reload.
- **Connected but write actions remain disabled**
  - Switch wallet network to Ethereum mainnet (`chainId 1`) and confirm Terms checkbox is accepted in-page.
- **Jobs table does not populate on non-mainnet**
  - Expected behavior. The page intentionally requests mainnet for live job loading.
- **IPFS/completion metadata inspection fails**
  - Check URI format (`ipfs://`, `https://`, `http://`, or `ens://` accepted in-page) and gateway availability/CORS behavior.
- **deBridge embed fails to load**
  - Browser policy, extension blocking, or network controls may block the embed script/iframe; use the page fallback controls.

## Status and lifecycle

- This file is a **versioned standalone artifact** (`...v21.html`).
- Earlier versioned artifacts are retained in `ui/` (`v13`–`v20`).
- The broader/full UI remains under active development in the Next.js app under `ui/` with documentation in `docs/ui/`.

## Related documentation

- UI docs hub: `docs/ui/README.md`
- UI architecture and runbooks: `docs/ui/OVERVIEW.md`, `docs/ui/RUNBOOK.md`, `docs/ui/OPS_RUNBOOK.md`
- Root UI inventory: `ui/README.md`
- Hardhat operator guide (official): `hardhat/README.md`
- ENS replacement runbook: `docs/DEPLOYMENT/ENS_JOB_PAGES_MAINNET_REPLACEMENT.md`
- Deployment troubleshooting: `docs/TROUBLESHOOTING_DEPLOYMENT_AND_ENS.md`
