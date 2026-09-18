# AGIJobManager UI — v1.0.4

Use the [versioned v1.0.4 USDC console](https://github.com/MontrealAI/AGIJobManager/releases/download/v1.0.4/agijobmanager-usdc.html), matching [repository artifact](agijobmanager-usdc.html), and [operator guide](../docs/ui/GENESIS_JOB_MAINNET_HTML_UI.md). Verified v0.9.6 and v1.0.4 managers share the required ABI and deployed runtime bytecode; v1.0.4 construction initializes NFT admission as disabled. Existing manager settings and job snapshots are unchanged. This console retains the v0.9.6 saved-context namespace, rechecking wallet, chain and manager before writes. v0.9.5 and older managers lack getJobBonds; keep their jobs on their original interfaces. See [compatibility](../docs/qualification/OPERATIONS_V097.md). No live manager, recipient wallets or production owner is supplied by default.

All current job payments and bonds use native Circle USDC with six decimals. Verified v0.9.6 managers remain compatible. Moving from the original-token manager requires a fresh USDC deployment; the original manager keeps its own jobs and ENS wiring. Follow the [USDC migration guide](../docs/USDC_MIGRATION.md) and [Hardhat deployment guide](../hardhat/README.md).

## Choose a surface

| Surface | Purpose | Configuration and status |
| --- | --- | --- |
| [USDC standalone console](agijobmanager-usdc.html) | Versioned single-file participant and owner interface | Ethereum mainnet; voting requires the `getJobBonds` getter introduced in v0.9.6; no embedded live-manager default or token bridge |
| [Operator interface](../docs/ui/agijobmanager.html) | Additional USDC role and owner workflows | Configure the intended manager and network |
| Next.js app in this directory | Broader UI, development, simulation and demo workflows | Environment-driven; manager address starts empty |
| `dist-ipfs/agijobmanager.html` | Generated single-file distribution | Built and verified from the UI source; configuration remains deployment-required |
| [Historical console sources](https://github.com/MontrealAI/AGIJobManager/tree/v0.4.0/ui) | Reproduce earlier interfaces | Legacy evidence; do not use as current USDC deployment configuration |

The Pages filename `agijobmanagerv0.html` is a historical compatibility alias. The repository workflow copies the current standalone source there, so it can change with `main`; its name is neither a release version nor evidence of a live deployment. Use an immutable release download and matching checksums for reproducible operations. See [Pages publishing](../docs/ui/GITHUB_PAGES.md).

## Before participant actions

AGI Agents normally require membership under `agent.agi.eth` or `alpha.agent.agi.eth`; AGI Validators under `club.agi.eth` or `alpha.club.agi.eth`. Use only the label, and verify the connected wallet's supported NameWrapper authority or resolver address. The manager preserves owner-managed additional lists and Merkle proofs as explicit membership exceptions. Agents also require an eligible enabled NFT when the job's posting-time NFT requirement is on (the default). Optional ENS job pages are separate metadata and do not grant either participant role.

Verify the chain, manager, canonical USDC, both recipients and current role/job state before signing. Review exact USDC allowance and bond requirements and retain ETH for gas. UI checks complement source/runtime verification; a wallet prompt or simulation does not guarantee inclusion or success.

## Use the standalone console

Open `agijobmanager-usdc.html` directly, or from the repository root serve this directory locally:

```bash
python3 -m http.server 8000 --bind 127.0.0.1 --directory ui
```

Open `http://127.0.0.1:8000/agijobmanager-usdc.html`. Browser wallets and network resources are still needed for live operations. Enter no seed phrase or private key into the page. Read [the console guide](../docs/ui/GENESIS_JOB_MAINNET_HTML_UI.md) for transaction/recovery behavior.

## Develop the Next.js UI

From the repository root, use Node 22.23.2 and the committed lockfile:

```bash
cd ui
npm ci
if [ ! -e .env.local ] && [ ! -L .env.local ]; then cp .env.example .env.local; fi
NEXT_PUBLIC_DEMO_MODE=1 NEXT_PUBLIC_DEMO_ACTOR=visitor npm run dev
```

The guarded copy preserves an existing environment. Demo mode uses synthetic data and does not establish production readiness. For live configuration, review the selected chain and verified manager/owner/deployment block; examples do not supply an official new USDC deployment.

The [UI documentation hub](../docs/ui/README.md) covers architecture and development. From `ui/`, the supported qualification commands include:

```bash
npm run check:no-binaries
npm run lint
npm run typecheck
npm test
npm run test:e2e
npm run test:a11y
npm run test:headers
npm run build:ipfs
npm run verify:ipfs
npm run verify:deterministic
npm run verify:committed-html
```

Use the repository's required CI gates and exact release evidence to assess a source revision. Deployment, manager ownership acceptance, ENS root authority and live-instance activation remain in the [operator runbooks](../docs/DEPLOYMENT/README.md); publishing an interface performs none of those transactions.
