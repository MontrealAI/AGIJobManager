# Standalone HTML UI: `agijobmanager_genesis_job_mainnet_2026-03-05-v21.html`

## At-a-glance navigation

- [Quick start (safe and practical)](#quick-start-safe-and-practical)
- [Embedded network and contract assumptions (v21)](#embedded-network-and-contract-assumptions-v21)
- [Security and trust hygiene](#security-and-trust-hygiene)
- [Troubleshooting (standalone page)](#troubleshooting-standalone-page)
- [What this page does not replace](#what-this-page-does-not-replace)
- [Standalone artifact inventory](./STANDALONE_HTML_UIS.md)

## What this page is

`ui/agijobmanager_genesis_job_mainnet_2026-03-05-v21.html` is a **standalone, versioned HTML interface artifact** for AGIJobManager mainnet operations and demonstrations.

Version/lifecycle posture:
- This file is a point-in-time artifact (`v21`) committed in-repo for reproducible browser-based operations and review.
- It is intentionally additive to the broader/full UI effort (Next.js app in `ui/src/`, docs in [docs/ui/README.md](./README.md)).
- It is not the deployment authority and not a replacement for Hardhat runbooks.

It is intentionally additive:
- It gives operators and reviewers a single-file browser surface.
- It does **not** replace the broader Next.js UI effort in `ui/`.

Related UI hub:
- [docs/ui/README.md](./README.md)

## Decision: should you use this page right now?

Use this page when you need a **single-file browser artifact** for intentional **Ethereum mainnet** review or operations.

Do not use it as a deployment source of truth:
- Deployment and cutover authority remain in [hardhat/README.md](../../hardhat/README.md) and [docs/DEPLOYMENT/ENS_JOB_PAGES_MAINNET_REPLACEMENT.md](../DEPLOYMENT/ENS_JOB_PAGES_MAINNET_REPLACEMENT.md).
- If guidance differs, trust deployment runbooks and on-chain contract behavior.

## Fast audience routing

- **Contract owner/operator:** use this page for day-to-day inspection and transaction submission, but keep deployment and cutover actions anchored in [hardhat/README.md](../../hardhat/README.md) and [docs/DEPLOYMENT/ENS_JOB_PAGES_MAINNET_REPLACEMENT.md](../DEPLOYMENT/ENS_JOB_PAGES_MAINNET_REPLACEMENT.md).
- **Reviewer/auditor/demo participant:** use this page for reproducible browser walkthroughs of live mainnet state and action surfaces.
- **Full UI contributor:** use this page as a standalone snapshot reference; broader product/UI roadmap lives in [docs/ui/README.md](./README.md).

## Canonical scope and positioning

- **Protocol authority:** the deployed smart contracts remain authoritative.
- **Deployment authority:** Hardhat remains the official deployment/operator path (`hardhat/README.md`).
- **Truffle:** legacy/supported path remains documented.
- **ENSJobPages replacement:** still follows the additive replacement flow documented in deployment runbooks.

This page is a UI client for that ecosystem, not a deployment framework.

## Grounded capabilities in v21

Based on the file contents, this standalone page includes:

- Wallet connection and network state display.
- Ethereum mainnet gating for write actions (`chainId 1` behavior).
- Embedded AGIJobManager / ENSJobPages / token and vault addresses.
- Mission/readiness dashboards for employer/agent/validator posture.
- Live jobs table with search, filters, sorting, watchlist, and detail modals.
- On-chain actions for lifecycle paths (create/apply/approve/disapprove/finalize/dispute/expire/cancel, ENS lock, request completion), with tracked transaction UX.
- Local-first job metadata builder and IPFS upload helpers (configurable endpoint/JWT fields stored in browser context).
- Completion helper that normalizes URIs and submits completion requests.
- `$AGIALPHA` bridge/conversion console (deBridge widget embedding plus `depositExact` flow into `AGIALPHAEqualMinterVault`).
- Embedded Terms & Conditions section and in-page acceptance gating for write controls.

Grounding note: this list is based on visible controls, embedded ABIs, and in-page handlers in the `v21` file.

## Grounded page sections and expected outcomes (v21)

| Section in page | What you do there | Expected result |
| --- | --- | --- |
| Mission Control / readiness cards | Connect wallet, switch network, verify posture, jump to next action. | You get a clear "what to do next" prompt and write-gate status before any transaction. |
| Jobs board + detail modal | Search/filter jobs, inspect status, then trigger lifecycle actions when eligible. | You can inspect live state and execute allowed job actions one step at a time. |
| Metadata + completion helpers | Prepare spec/completion URI inputs, normalize URI format, and stage data. | You reduce operator input mistakes before submitting on-chain writes. |
| AGIALPHA bridge/conversion area | Review bridged vs official balances, run approval, run vault conversion, optionally use embedded deBridge route. | Bridged token can be converted into official Ethereum `$AGIALPHA` (when wallet and vault state permit). |
| Terms & Conditions area | Review and accept embedded terms. | Write controls remain intentionally locked until terms are accepted in-page. |

Inference boundary: this table describes visible UX and method wiring present in `v21`; it does not redefine protocol-level permissions.

## Grounded non-goals (important)

This artifact does **not**:

- Deploy contracts or replace deployment runbooks.
- Replace ENSJobPages cutover/owner procedures.
- Introduce a backend service requirement.
- Change AGIJobManager or ENSJobPages protocol rules.

## Contract interaction map (grounded, operator-friendly)

This section maps major UI actions to the contract methods surfaced in the file's embedded ABIs.

| UI workflow area | Primary contract target | Method examples exposed in page | Operator note |
| --- | --- | --- | --- |
| Job creation and hiring | `AGIJobManager` | `createJob`, `applyForJob` | Requires mainnet wallet and role eligibility/parameters. |
| Completion and review | `AGIJobManager` | `requestJobCompletion`, `validateJob`, `disapproveJob` | Completion URI quality directly affects validator decisions. |
| Settlement and exception paths | `AGIJobManager` | `finalizeJob`, `disputeJob`, `expireJob`, `cancelJob` | State-dependent actions; check job status first. |
| ENS per-job controls | `AGIJobManager` + `ENSJobPages` | `lockJobENS` and ENS reads shown in UI | Additive ENS layer; settlement authority remains in AGIJobManager. |
| Bridge / conversion helper | bridged/offical token + vault | ERC-20 `approve`, vault `depositExact` | Token operations are separate transactions; verify spender and amount. |

If uncertain about exact callable semantics, confirm against contract docs/runbooks before signing.

## Write-capable transaction methods exposed in v21

The standalone page includes handlers that can submit the following transactions (subject to role/state checks enforced by contracts):

- `AGIJobManager.createJob(...)`
- `AGIJobManager.applyForJob(...)`
- `AGIJobManager.requestJobCompletion(...)`
- `AGIJobManager.validateJob(...)`
- `AGIJobManager.disapproveJob(...)`
- `AGIJobManager.finalizeJob(...)`
- `AGIJobManager.disputeJob(...)`
- `AGIJobManager.expireJob(...)`
- `AGIJobManager.cancelJob(...)`
- `AGIJobManager.lockJobENS(...)`
- ERC-20 `approve(...)` for AGIJobManager and conversion spender flows
- `AGIALPHAEqualMinterVault.depositExact(...)`

Safety reminder:
- The UI can initiate these calls.
- Contract permissions, state guards, and wallet confirmation remain decisive.
- Always verify target address, method intent, and value fields before signing.

## Intended audience

Primary:
- Operators and advanced users needing a single-file browser artifact for live mainnet interaction.
- Reviewers/auditors/demo participants validating end-to-end operator UX without running the full Next.js stack.

Secondary:
- Developers comparing standalone snapshots (`v13` ... `v21`) during UI iteration.

## Quick start (safe and practical)

### Copy/paste open commands

```bash
cd ui
python3 -m http.server 8000
```

Open:

```text
http://127.0.0.1:8000/agijobmanager_genesis_job_mainnet_2026-03-05-v21.html
```

(Direct `file://` open can work, but local HTTP is more reliable for wallet/provider behavior.)

### Preconditions

- Modern browser (Chrome/Brave/Firefox-class) with JavaScript enabled.
- EIP-1193 wallet extension support for write paths (for example MetaMask or Rabby).
- Wallet account on **Ethereum mainnet** for transaction-capable workflows.
- Network access to external scripts/services used by the page (Web3 CDN and deBridge widget script).

No local backend, indexer, or database is required for this standalone page.

### Mainnet posture

- This artifact is a **mainnet-targeted versioned snapshot**.
- Read actions are broadly available; write actions require wallet, mainnet, and terms acceptance.
- For non-mainnet environments, use broader UI/development docs instead of repurposing this file.

### Open method

Use either:
1. Direct file open (`file://.../ui/agijobmanager_genesis_job_mainnet_2026-03-05-v21.html`), or
2. Serve over HTTP from repository root.

Recommended HTTP approach:

```bash
cd /workspace/AGIJobManager
python3 -m http.server 8000
```

Then open:

```text
http://localhost:8000/ui/agijobmanager_genesis_job_mainnet_2026-03-05-v21.html
```

HTTP serving is generally safer for extension compatibility and future browser restrictions.

## Quick open matrix

| Goal | Recommended open method | Why |
| --- | --- | --- |
| Fast local review without wallet writes | `file://` open is acceptable | Minimal setup for read-only walkthroughs. |
| Wallet-connected operations | Serve over HTTP (`python3 -m http.server 8000`) | More consistent extension/provider behavior across browsers. |
| Team review/demo | Serve over HTTP from a clean repo clone | Reproducible path and easier troubleshooting. |

### Minimal safe operating sequence

1. Open via local HTTP.
2. Confirm filename/path ends with `agijobmanager_genesis_job_mainnet_2026-03-05-v21.html`.
3. Connect wallet and confirm Ethereum Mainnet.
4. Confirm address panel values against deployment docs.
5. Accept terms in-page.
6. Perform one read/check action first, then write actions one at a time.

## How to use it (operator flow)

1. Open the page and verify the header/network status blocks.
2. Click **Connect Wallet**.
3. If prompted, switch wallet to Ethereum Mainnet.
4. Review readiness status (wallet/network/terms/ENS posture).
5. Accept terms in-page to unlock write controls.
6. Use the section relevant to your role:
   - **Employer:** metadata builder + `createJob`.
   - **Agent:** find assigned job and submit completion.
   - **Validator:** inspect completion and submit approve/disapprove.
   - **Any authorized actor:** dispute/finalize/expire/cancel paths as allowed by contract state.
7. Confirm each transaction in wallet only after verifying chain, method intent, and contract target.

Expected result:
- Read state refreshes from mainnet contracts.
- Eligible actions produce wallet prompts and on-chain transactions.
- The in-page activity trail logs pending/success/failure states for actions initiated from this session.

## Practical pre-sign checklist (copy/paste)

Use this checklist before each write transaction:

- [ ] I am connected to **Ethereum Mainnet** (`chainId 1`).
- [ ] The page address panel matches expected deployment docs for my operation.
- [ ] I reviewed the exact action being triggered (create/apply/approve/dispute/finalize/etc.).
- [ ] I reviewed value fields (amounts, URIs, ENS names, durations) for typo-risk.
- [ ] I understand this UI is a client and on-chain contracts are authoritative.
- [ ] I accepted in-page terms intentionally for this session.


## Read-only vs action-capable behavior

- **Read-only (no wallet):** You can view static sections and most dashboard content, but cannot submit on-chain transactions.
- **Action-capable (wallet + mainnet + terms accepted):** Write buttons unlock and the page can submit contract transactions through your wallet.

Write-gate conditions in v21 are explicitly tied to:
1. wallet connection,
2. Ethereum mainnet (`chainId 1`), and
3. in-page terms acceptance checkbox.

## Embedded network and contract assumptions (v21)

The page hardcodes the following addresses/constants in the script block:

- `AGI_JOB_MANAGER`: `0xB3AAeb69b630f0299791679c063d68d6687481d1`
- `ENS_JOB_PAGES`: `0xc19A84D10ed28c2642EfDA532eC7f3dD88E5ed94`
- `NAME_WRAPPER`: `0xD4416b13d2b3a9aBae7AcD5D6C2BbDBE25686401`
- `BRIDGED_AGIALPHA_ETH`: `0x2e8Fb54C3eC41F55F06C1F082C081a609EaA4ebe`
- `OFFICIAL_AGIALPHA_ETH`: `0xa61a3b3a130a9c20768eebf97e21515a6046a1fa`
- `AGIALPHA_EQUAL_MINTER_VAULT`: `0x27d6fe8668c6f652ac26ffae020d949f03af80d8`
- `DEBRIDGE_ETH_CHAIN_ID`: `1`

Operator implication:
- Treat this artifact as a **mainnet-targeted versioned snapshot**.
- Re-verify addresses against current deployment documentation before signing transactions.
- If you need a different network, use the broader UI workflow rather than this fixed-address snapshot.

## Broader/full UI status and where to track it

The broader UI is a separate Next.js surface that continues to evolve in parallel with this standalone artifact.

- Source tree: `ui/src/`
- Broader UI docs hub: [docs/ui/README.md](./README.md)
- UI directory inventory (artifact + app): [ui/README.md](../../ui/README.md)

Use this `v21` runbook when you intentionally need a single-file, versioned browser interface. Use the broader UI docs when you need roadmap/development/testing context.

## Relationship to other UI artifacts in `ui/`

- `v21` is the documented standalone artifact for this runbook.
- Other `agijobmanager_genesis_job_mainnet_2026-03-05-v*.html` files are adjacent snapshots for comparison/reproducibility.
- The Next.js app in `ui/` remains the broader/full UI effort under active development.

Use this document when you intentionally operate the standalone, versioned single-file surface.

## External dependencies used by this standalone page

The HTML file loads third-party resources directly in-browser:

- Web3 runtime from jsDelivr: `https://cdn.jsdelivr.net/npm/web3@4.8.0/dist/web3.min.js`
- deBridge widget script: `https://app.debridge.com/assets/scripts/widget.js`

Operational implication:
- If your browser, policy, or network blocks these hosts, some wallet/bridge features can degrade or fail.
- Core contract truth remains on-chain; this page is a convenience client.

## Local browser persistence used by this page

The page stores some operator preferences in browser `localStorage` (for example filters/drafts/IPFS helper settings).

Practical implications:
- Preferences can persist across reloads in the same browser profile.
- Sensitive values entered into helper fields (for example IPFS JWT) can remain in local browser storage until cleared.
- For high-trust or shared-machine workflows, use a dedicated profile and clear site data after use.

## Security and trust hygiene

Before any write action:

- Verify wallet is on Ethereum Mainnet.
- Verify target contract addresses against current docs/runbooks.
- Verify method intent (e.g., create/apply/validate/dispute/finalize) before confirming wallet signatures.
- Verify URI inputs (`ipfs://`, ENS names, HTTPS links) are expected and operator-approved.

Important distinction:
- This page is a static client-side interface.
- It does not change protocol rules.
- AGIJobManager and ENSJobPages contracts remain the source of truth.

## Relationship to ENSJobPages and AGIJobManager

Plain-language model:

- **AGIJobManager:** core job escrow/lifecycle/settlement/dispute state machine.
- **ENSJobPages:** additive ENS identity/page layer attached to AGIJobManager via configured hooks.
- **This standalone HTML page:** operator surface that reads state from these contracts and submits transactions to them.

The page also surfaces ENS-oriented context (label/name/URI previews and ENS-lock actions) but does not redefine ENS replacement procedures.

Operationally, AGIJobManager settlement/dispute outcomes remain authoritative even when ENS side-effects fail.

## Status and lifecycle

- This file documents a **versioned standalone artifact**: `v21`.
- It is intended as an additive, practical browser interface for current operator/reviewer workflows.
- The broader/full UI effort is still in active development in `ui/` (Next.js surface) and tracked in [docs/ui/README.md](./README.md).
- When operational guidance conflicts, treat deployment/operator docs and on-chain contract behavior as canonical.

## What this page does not replace

- It does not replace Hardhat deployment and verification workflows.
- It does not replace owner/operator runbooks for ENSJobPages replacement.
- It does not represent completion of the broader/full UI roadmap.

For full UI development and operations docs, use:
- [docs/ui/README.md](./README.md)
- [ui/README.md](../../ui/README.md)

## Troubleshooting (standalone page)

### Wallet not detected / cannot connect

- Ensure an EIP-1193 wallet extension is installed/enabled.
- Reload the page after enabling the extension.
- If using strict browser privacy mode, retry in a standard profile.

### Write buttons remain disabled

Typical causes in v21:
- Wallet not connected.
- Not on Ethereum Mainnet.
- Terms not accepted in-page.

### Network mismatch

- Use wallet network switch to Ethereum Mainnet.
- The page attempts chain switching, but wallet policy/permissions can block automated switching.

### Job/contract data not loading

- Check wallet connectivity and RPC health.
- Check browser console for RPC or provider errors.
- Confirm the hardcoded contract addresses are valid for your intended environment (this artifact is mainnet-targeted).

### Browser opens file but wallet injection is inconsistent

- Prefer HTTP serving over `file://` mode.
- Disable aggressive extension/privacy isolation features for the local host session.
- Reconnect wallet after any chain/account switch event.

### IPFS upload helper failures

- Validate endpoint URL and JWT/credentials.
- Confirm CORS policy and request limits of your chosen pinning endpoint.
- As fallback, publish metadata externally and paste a canonical URI manually.

### deBridge widget not loading

- Check network access to `https://app.debridge.com/assets/scripts/widget.js`.
- Content blocking/privacy tooling may block third-party scripts/iframes.
- Continue with non-embedded/manual asset routing if policy requires it.

### Bridged token arrives but official mint fails

- Confirm wallet is on Ethereum Mainnet before calling `depositExact`.
- Confirm bridged-token balance is non-zero.
- If approval is requested, wait for approval confirmation before retrying mint.
- Re-check custom recipient formatting before signing.

### Wrong contract target concern

- Stop before signing.
- Compare displayed addresses with the deployment/operator docs for your intended environment.
- If you are not intentionally operating on Ethereum mainnet with the embedded addresses, do not use this artifact for write actions.

## Related docs

- Root gateway: [README.md](../../README.md)
- Docs hub: [docs/README.md](../README.md)
- Hardhat (official path): [hardhat/README.md](../../hardhat/README.md)
- ENS replacement runbook: [docs/DEPLOYMENT/ENS_JOB_PAGES_MAINNET_REPLACEMENT.md](../DEPLOYMENT/ENS_JOB_PAGES_MAINNET_REPLACEMENT.md)
- ENS behavior overview: [docs/ENS/ENS_JOB_PAGES_OVERVIEW.md](../ENS/ENS_JOB_PAGES_OVERVIEW.md)
- Deployment troubleshooting: [docs/TROUBLESHOOTING_DEPLOYMENT_AND_ENS.md](../TROUBLESHOOTING_DEPLOYMENT_AND_ENS.md)
- UI directory inventory: [ui/README.md](../../ui/README.md)
