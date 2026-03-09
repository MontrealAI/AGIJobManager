# Standalone HTML UI: `agijobmanager_genesis_job_mainnet_2026-03-05-v21.html`

## What this page is

`ui/agijobmanager_genesis_job_mainnet_2026-03-05-v21.html` is a **standalone, versioned HTML interface artifact** for AGIJobManager mainnet operations and demonstrations.

It is intentionally additive:
- It gives operators and reviewers a single-file browser surface.
- It does **not** replace the broader Next.js UI effort in `ui/`.

Related UI hub:
- [docs/ui/README.md](./README.md)

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

## Intended audience

Primary:
- Operators and advanced users needing a single-file browser artifact for live mainnet interaction.
- Reviewers/auditors/demo participants validating end-to-end operator UX without running the full Next.js stack.

Secondary:
- Developers comparing standalone snapshots (`v13` ... `v21`) during UI iteration.

## Quick start (safe and practical)

### Preconditions

- Modern browser with EIP-1193 wallet extension support (for write paths).
- Wallet account on **Ethereum mainnet** for transaction-capable workflows.
- Network access to external scripts/services used by the page (for example Web3 CDN and deBridge widget script).

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

### IPFS upload helper failures

- Validate endpoint URL and JWT/credentials.
- Confirm CORS policy and request limits of your chosen pinning endpoint.
- As fallback, publish metadata externally and paste a canonical URI manually.

### deBridge widget not loading

- Check network access to `https://app.debridge.com/assets/scripts/widget.js`.
- Content blocking/privacy tooling may block third-party scripts/iframes.
- Continue with non-embedded/manual asset routing if policy requires it.

## Related docs

- Root gateway: [README.md](../../README.md)
- Docs hub: [docs/README.md](../README.md)
- Hardhat (official path): [hardhat/README.md](../../hardhat/README.md)
- ENS replacement runbook: [docs/DEPLOYMENT/ENS_JOB_PAGES_MAINNET_REPLACEMENT.md](../DEPLOYMENT/ENS_JOB_PAGES_MAINNET_REPLACEMENT.md)
- ENS behavior overview: [docs/ENS/ENS_JOB_PAGES_OVERVIEW.md](../ENS/ENS_JOB_PAGES_OVERVIEW.md)
- Deployment troubleshooting: [docs/TROUBLESHOOTING_DEPLOYMENT_AND_ENS.md](../TROUBLESHOOTING_DEPLOYMENT_AND_ENS.md)
