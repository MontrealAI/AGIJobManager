# AGIJobManager ALPHA v0

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Solidity](https://img.shields.io/badge/solidity-0.8.19-363636.svg)](contracts/AGIJobManager.sol)
[![Truffle](https://img.shields.io/badge/truffle-5.x-3fe0c5.svg)](https://trufflesuite.com/)
[![CI](https://github.com/MontrealAI/AGIJobManager/actions/workflows/ci.yml/badge.svg)](https://github.com/MontrealAI/AGIJobManager/actions/workflows/ci.yml)

**AGIJobManager** is MONTREAL.AI’s on-chain enforcement layer for agent–employer workflows: validator-gated job escrow, payouts, dispute resolution, and reputation tracking, with ENS/Merkle role gating and ERC‑721 job NFT issuance. It is the *enforcement* half of a “Full‑Stack Trust Layer for AI Agents.”

> **Status / Caution**: Experimental research software. Treat deployments as high-risk until you have performed independent security review, validated parameters, and ensured operational readiness. No public audit report is included in this repository.

## At a glance

**What it is**
- **Job escrow & settlement engine**: employer-funded jobs, agent assignment, validator approvals/disapprovals (thresholded), moderator dispute resolution, payouts/refunds.
- **Reputation mapping**: on-chain reputation updates for agents and validators derived from job outcomes.
- **Job NFT issuance**: mints an ERC‑721 “job NFT” on completion for the employer.
- **Trust gating**: role eligibility enforced via explicit allowlists, Merkle proofs, and ENS/NameWrapper/Resolver ownership checks.

**What it is NOT**
- **Not an on-chain ERC‑8004 implementation**: ERC‑8004 is consumed off-chain; this repo does not integrate it on-chain.
- **Not a generalized identity or reputation registry**: only contract-local reputation mappings and ENS/Merkle gating are provided.
- **Not a generalized NFT marketplace**: this contract does not embed a marketplace; NFTs trade externally via standard ERC‑721 approvals and transfers.
- **Not a decentralized court or DAO**: moderators and the owner have significant authority; validator membership remains permissioned even with bonded voting.

## Important trust notes
- **Owner-operated**: the owner can pause/unpause, tune parameters, and manage allowlists/blacklists.
- **Escrow invariant**: the owner can withdraw **treasury only** (AGI balance minus `lockedEscrow`, `lockedAgentBonds`, `lockedValidatorBonds`, and `lockedDisputeBonds`) and only while paused; escrowed funds and bonds are not withdrawable.
- **Pause semantics**: new activity is blocked, but completion requests and settlement exits remain available.
- **Identity wiring lock**: `lockIdentityConfiguration()` permanently freezes token/ENS/root-node wiring, while leaving operational controls intact.
- **Validator incentives**: validators post a bond per vote (capped at payout), earn rewards when their vote matches the final outcome, and are slashed when they are wrong.
- **Agent incentives**: agents post a payout‑proportional bond (minimum floor, capped at payout) at apply time; bonds are returned on agent wins and fully slashed to employers on employer wins/expiry.
- **Reputation**: reputation increases with payout size and job duration (delayed completion requests do not increase scores).

### Platform retained revenue (agent wins)
When a job settles in favor of the agent, any remainder after the agent payout and validator budget (caused by integer division rounding or intentional headroom) is **retained by the platform**. This retained amount stays in the contract and becomes owner‑withdrawable **only while paused** via `withdrawAGI()`, subject to the `withdrawableAGI()` escrow‑solvency checks.

**Trust model summary**: owner‑operated escrow; escrow protected by `lockedEscrow`; owner withdraws only non‑escrow funds under defined conditions.

## Incentives & game theory
AGIJobManager is optimized for a **business‑run escrow** with a **permissioned validator club** and a **trusted moderator/owner backstop**—not a trustless court.
“Optimal” here means **liveness**, **priced deviations**, **predictable validator turnout**, and **cheap operations** under that explicit trust model.
Validators opt‑in **per job** by voting within `completionReviewPeriod`; disputes freeze voting and rely on moderators.
For the full incentive map, deviation strategies, and parameter playbooks, see
[`docs/game-theory.md`](docs/game-theory.md).
Validators should review the 10‑minute workflow in [`docs/validators.md`](docs/validators.md);
operators should review parameter‑tuning and off‑chain governance before production use.

## NFT trading

AGI Jobs are standard ERC‑721 NFTs. They can be traded on OpenSea and other marketplaces using normal approvals and transfers. This contract does not implement an internal marketplace.

## Documentation

Start with the documentation index: [`docs/00_INDEX.md`](docs/00_INDEX.md).

Documentation hub: [`docs/README.md`](docs/README.md).

Core operator/integrator/auditor docs:
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)
- [`docs/PROTOCOL_FLOW.md`](docs/PROTOCOL_FLOW.md)
- [`docs/CONFIGURATION.md`](docs/CONFIGURATION.md)
- [`docs/DEPLOY_RUNBOOK.md`](docs/DEPLOY_RUNBOOK.md)
- [`docs/ENS_INTEGRATION.md`](docs/ENS_INTEGRATION.md)
- [`docs/SECURITY_MODEL.md`](docs/SECURITY_MODEL.md)
- [`docs/TROUBLESHOOTING.md`](docs/TROUBLESHOOTING.md)
- [`docs/GLOSSARY.md`](docs/GLOSSARY.md)
- [`docs/REPOSITORY_INVENTORY.md`](docs/REPOSITORY_INVENTORY.md)

## Quickstart

```bash
npm ci  # deterministic install from package-lock.json
npm run build
npm run test
```

Additional checks used in CI:

```bash
npm run lint
npm run size
```

## Testing

- Testing runbook and deterministic guidance: [`docs/TESTING.md`](docs/TESTING.md)
- Risk-based coverage matrix and regression policy: [`docs/TEST_PLAN.md`](docs/TEST_PLAN.md)
- Diagram-first architecture of test harness and failure modes: [`docs/ARCHITECTURE_TESTS.md`](docs/ARCHITECTURE_TESTS.md)

## Architecture + illustrations

### Job lifecycle (state machine)
```mermaid
stateDiagram-v2
    [*] --> Open: createJob
    Open --> InProgress: applyForJob
    InProgress --> CompletionRequested: requestJobCompletion

    CompletionRequested --> ApprovalWindow: validateJob (approval threshold)
    ApprovalWindow --> Completed: finalizeJob (after challenge window)
    CompletionRequested --> Completed: finalizeJob (timeout, no validator activity)
    CompletionRequested --> Refunded: finalizeJob (timeout, employer win)

    CompletionRequested --> Disputed: disapproveJob (disapproval threshold)
    CompletionRequested --> Disputed: disputeJob (manual)

    Disputed --> Completed: resolveDisputeWithCode(AGENT_WIN)
    Disputed --> Refunded: resolveDisputeWithCode(EMPLOYER_WIN)
    Disputed --> Completed: resolveStaleDispute (owner, timeout)

    InProgress --> Expired: expireJob (timeout, no completion request)

    Open --> Deleted: cancelJob (employer)
    Open --> Deleted: delistJob (owner)
```
*Note:* `validateJob`/`disapproveJob` require `completionRequested` to be true; validators can only act after the agent submits completion metadata. `resolveDispute` with a non‑canonical resolution string maps to `NO_ACTION` and leaves the dispute active. Agent‑win dispute resolution requires a prior completion request so settlement always has completion metadata; agents may submit completion even if a dispute is already open, including after the nominal duration has elapsed or while paused for dispute recovery. `Deleted` corresponds to cancelled/delisted jobs where the job struct is cleared (`employer == address(0)`).

**Settlement invariant (payout + NFT)**: the agent can only be paid and the completion NFT can only be minted after a completion request is recorded on-chain **and** a non-empty, valid completion metadata URI is stored. Moderators/owners cannot award an agent win without that completion request, and the job NFT always points to the completion metadata (not the job spec).

**Dispute lane policy**
- Disputes can only be initiated after completion is requested (`completionRequested == true`).
- Once disputed, validator voting is frozen; approvals/disapprovals no longer progress settlement.
- Settlement while disputed happens only via moderator resolution or owner stale‑dispute resolution (pause optional, after the dispute review window).

### Full‑stack trust layer (signaling → enforcement)
```mermaid
flowchart LR
    subgraph Off-chain signaling
        A[Agents, Validators, Observers] --> B[ERC-8004 signals]
        B --> C[Indexers / Rankers]
        C --> D[Policy decisions<br/>allowlists, trust tiers]
    end

    D -->|Merkle roots & allowlists| E[AGIJobManager contract]
    E <-->|ENS + NameWrapper + Resolver| F[ENS contracts]
    E --> G[Escrow, payouts,<br/>reputation, job NFTs]
```

## Roles & permissions

| Role | Capabilities | Trust considerations |
| --- | --- | --- |
| **Owner** | Pause/unpause, set parameters, manage allowlists/blacklists, add moderators and AGI types, withdraw surplus ERC‑20 (balance minus locked escrow + bonds). | Highly privileged. Compromise or misuse can override operational safety. |
| **Moderator** | Resolve disputes via `resolveDispute`. | Central dispute authority; outcomes depend on moderator integrity. |
| **Employer** | Create jobs, fund escrow, cancel pre-assignment, dispute jobs, receive job NFTs. | Funds are custodied by contract until resolution. |
| **Agent** | Apply for jobs, request completion, earn payouts and reputation. | Eligibility gated by allowlists/Merkle/ENS. |
| **Validator** | Approve/disapprove jobs, earn payout share and reputation. | Eligibility gated by allowlists/Merkle/ENS. |

## Deploy & Ops

- Deployment sequence: [`docs/DEPLOY_RUNBOOK.md`](docs/DEPLOY_RUNBOOK.md)
- Day-2 operations and incident playbooks: [`docs/OPERATIONS.md`](docs/OPERATIONS.md)
- Configuration reference for owner-settable knobs: [`docs/CONFIGURATION.md`](docs/CONFIGURATION.md)
- Mainnet institutional runbook (deploy + incident + diagrams): [`docs/MAINNET_OPERATIONS.md`](docs/MAINNET_OPERATIONS.md)

### Mainnet token assumptions (production)

- AGIALPHA token address: `0xa61a3b3a130a9c20768eebf97e21515a6046a1fa`.
- The system expects exact-transfer ERC20 semantics (no fee-on-transfer/rebase behavior).
- AGIALPHA token-level pause must remain unpaused for normal operation.
- ENS integration is intentionally best-effort; core escrow/settlement correctness does not depend on ENS success.

### Dependency pinning note

- `@openzeppelin/contracts` is pinned to `4.9.6` to keep v4 import paths and Ownable constructor behavior stable across deterministic builds.

**Compiler note**: `AGIJobManager.sol` declares `pragma solidity ^0.8.19`, while the Truffle compiler is pinned to `0.8.23` in `truffle-config.js`. `viaIR` remains **disabled** to keep runtime bytecode under the EIP‑170 cap; the large job getter is kept internal and covered by targeted read‑model getters, keeping the legacy pipeline stable.

## Contract documentation

Detailed contract documentation lives in `docs/`:

- [Configure-once operations guide](docs/CONFIGURE_ONCE.md)
- [Configure-once deployment profile](docs/DEPLOYMENT_PROFILE.md)
- [Deployment checklist](docs/deployment-checklist.md)
- [Minimal governance operations](docs/minimal-governance.md)
- [Minimal governance model](docs/GOVERNANCE.md)
- [AGI Jobs one-pager (canonical narrative)](docs/AGI_JOBS_ONE_PAGER.md)
- [AGIJobManager overview](docs/AGIJobManager.md)
- [AGIJobManager interface reference](docs/AGIJobManager_Interface.md)
- [Contract read API (job getters)](docs/contract-read-api.md)
- [Bytecode size & job getters](docs/bytecode-and-getters.md)
- [AGIJobManager operator guide](docs/AGIJobManager_Operator_Guide.md)
- [AGIJobManager security considerations](docs/AGIJobManager_Security.md)
- [Identity lock & treasury pause semantics](docs/identity-lock-and-treasury.md)
- [Mainnet deployment & security overview](docs/mainnet-deployment-and-security-overview.md)
- [Security policy](SECURITY.md)

## Mainnet bytecode size (EIP-170)

Ethereum mainnet enforces a **24,576-byte** runtime bytecode cap (Spurious Dragon / EIP‑170). Always check the deployed runtime size before deploying:

```bash
node -e "const a=require('./build/contracts/AGIJobManager.json'); const b=(a.deployedBytecode||'').replace(/^0x/,''); console.log('AGIJobManager deployedBytecode bytes:', b.length/2)"
```

The mainnet deployment settings that keep `AGIJobManager` under the limit are:
- Optimizer: enabled
- `optimizer.runs`: **50** (pinned in `truffle-config.js`)
- `viaIR`: **false** by default
- `metadata.bytecodeHash`: **none**
- `debug.revertStrings`: **strip**
- `solc` version: **0.8.23** (pinned in `truffle-config.js`)
- `evmVersion`: **london** (or the target chain default)

To check runtime sizes locally after compilation:
```bash
node scripts/check-contract-sizes.js
```

To enforce a deterministic size gate on deployable contracts:
```bash
node scripts/check-bytecode-size.js
```

## Web UI (GitHub Pages)

- Canonical UI path in-repo: [`docs/ui/agijobmanager.html`](docs/ui/agijobmanager.html)
- Usage guide: [`docs/ui/README.md`](docs/ui/README.md)
- Expected Pages URL pattern: `https://<org>.github.io/<repo>/ui/agijobmanager.html`
- GitHub Pages setup: Settings → Pages → Source “Deploy from branch” → Branch `main` → Folder `/docs`.
- The contract address is user-configurable and must be provided until the new mainnet deployment is finalized.
- Contract address override: query param `?contract=0x...` or the UI **Save address** button (stored in `localStorage`).

## ERC‑8004 integration (control plane ↔ execution plane)
See [`docs/ERC8004.md`](docs/ERC8004.md) and [`docs/erc8004/README.md`](docs/erc8004/README.md) for the mapping spec, threat model, and adapter notes. Quick export example:

```bash
AGIJOBMANAGER_ADDRESS=0xYourContract \
ERC8004_IDENTITY_REGISTRY=0xIdentityRegistry \
ERC8004_REPUTATION_REGISTRY=0xReputationRegistry \
FROM_BLOCK=0 \
TO_BLOCK=latest \
OUT_DIR=integrations/erc8004/out \
truffle exec scripts/erc8004/export_feedback.js --network sepolia
```

Local dev chain (Ganache):
```bash
npx ganache -p 8545
npx truffle migrate --network development
```

## Deployment & verification (Truffle)

`truffle-config.js` is the source of truth for networks and env vars. A full guide lives in [`docs/Deployment.md`](docs/Deployment.md).

**Environment setup**
- Copy `.env.example` → `.env` (keep it local):
  ```bash
  cp .env.example .env
  ```
- `.env.example` lists every variable read by `truffle-config.js`, with optional defaults.

**Required (Sepolia / Mainnet)**
- `PRIVATE_KEYS`: comma-separated private keys.
- RPC configuration, one of:
  - `SEPOLIA_RPC_URL` / `MAINNET_RPC_URL`, or
  - `ALCHEMY_KEY` / `ALCHEMY_KEY_MAIN`, or
  - `INFURA_KEY`.

**Verification**
- `ETHERSCAN_API_KEY` for `truffle-plugin-verify`.

**Optional tuning**
- Gas & confirmations: `SEPOLIA_GAS`, `MAINNET_GAS`, `SEPOLIA_GAS_PRICE_GWEI`, `MAINNET_GAS_PRICE_GWEI`, `SEPOLIA_CONFIRMATIONS`, `MAINNET_CONFIRMATIONS`, `SEPOLIA_TIMEOUT_BLOCKS`, `MAINNET_TIMEOUT_BLOCKS`.
- Provider polling: `RPC_POLLING_INTERVAL_MS`.
- EVM version override: `SOLC_EVM_VERSION` (defaults to `london`).
- Compiler settings are pinned in `truffle-config.js` (solc `0.8.23`, runs `50`, `evmVersion` `london`).
- Local chain: `GANACHE_MNEMONIC`.

**Network notes**
- `test` uses an in-process Ganache provider for deterministic `truffle test` runs.
- `development`/Ganache typically needs no env vars.
- `sepolia` needs `ALCHEMY_KEY` (or `SEPOLIA_RPC_URL`) + `PRIVATE_KEYS`.
- `mainnet` needs `ALCHEMY_KEY_MAIN` (or `MAINNET_RPC_URL`) + `PRIVATE_KEYS`.
- `PRIVATE_KEYS` format: comma-separated, no spaces, keep it local.

> **Deployment caution**: `migrations/2_deploy_contracts.js` reads constructor parameters from environment variables. Ensure token/ENS/NameWrapper/root nodes/Merkle roots are set correctly before any production deployment.

## Security considerations

- **Centralization risk**: the owner can change critical parameters and withdraw surplus AGI (balance minus `lockedEscrow`) while paused; moderators can resolve disputes.
- **Eligibility gating**: ENS registry/NameWrapper/root nodes are intended to be configured before any job exists and then locked; Merkle roots remain configurable for allowlist updates.
- **Token compatibility**: ERC‑20 `transfer`/`transferFrom` may return `true`/`false` **or** return no data; calls that revert or return `false` are treated as failures. Fee‑on‑transfer, rebasing, and other balance‑mutating tokens are **not supported**; escrow deposits enforce exact amounts received.
- **Validator trust**: validators are allowlisted; no slashing or decentralization guarantees.
- **Duration enforcement**: only `requestJobCompletion` enforces the job duration; validators can still approve/disapprove after a deadline **once completion is requested** unless off‑chain policies intervene.
- **Dispute resolution codes**: moderators should use `resolveDisputeWithCode(jobId, code, reason)` with `code = 0 (NO_ACTION)`, `1 (AGENT_WIN)`, or `2 (EMPLOYER_WIN)`. The `reason` is freeform and does not control settlement. The legacy string-based `resolveDispute` is deprecated; non‑canonical strings map to `NO_ACTION` and keep the dispute active.
- **Agent payout snapshot**: the agent payout percentage is snapshotted at `applyForJob` and used at completion; later NFT transfers do **not** change payout for that job. Agents must have a nonzero AGI‑type payout tier at apply time (0% tiers cannot accept jobs), and `additionalAgents` only bypass identity checks (not payout eligibility).

## Pause behavior

Pause is an incident-response safety control. When paused, **new activity** is blocked (job creation, applications, validation/disputes), but safe exits remain available. Assigned agents can still call `requestJobCompletion`, and settlement exits (`cancelJob`, `expireJob`, `finalizeJob`) still work when their normal predicates are satisfied. Resume operations by unpausing once the issue is resolved.

See [`docs/Security.md`](docs/Security.md) for a detailed threat model and known limitations.

## Ecosystem links

- **Repository**: https://github.com/MontrealAI/AGIJobManager
- **Etherscan (deployment-specific)**: https://etherscan.io/address/<contract-address>
- **OpenSea (job NFTs, deployment-specific)**: https://opensea.io/assets/ethereum/<contract-address>
- **ERC‑8004 specification**: https://eips.ethereum.org/EIPS/eip-8004
- **ERC‑8004 deck (framing)**: https://github.com/MontrealAI/AGI-Alpha-Agent-v0/blob/main/docs/presentation/MONTREALAI_x_ERC8004_v0.pdf
- **ERC‑8004 deck (repo copy)**: [`presentations/MONTREALAI_x_ERC8004_v0.pdf`](presentations/MONTREALAI_x_ERC8004_v0.pdf)
- **Institutional overview (repo PDF)**: [`presentations/AGI_Eth_Institutional_v0.pdf`](presentations/AGI_Eth_Institutional_v0.pdf)
- **AGI‑Alpha‑Agent reference repo**: https://github.com/MontrealAI/AGI-Alpha-Agent-v0
- **ENS docs**: https://docs.ens.domains/
- **ENS NameWrapper**: https://docs.ens.domains/ens-improvement-proposals/ensip-10-namewrapper
- **OpenZeppelin Contracts**: https://docs.openzeppelin.com/contracts/4.x/
- **Truffle**: https://trufflesuite.com/docs/truffle/

## Documentation index

Start here:
- [`docs/README.md`](docs/README.md)
- [Mainnet deployment & security overview](docs/mainnet-deployment-and-security-overview.md)
- [Security policy](SECURITY.md)
- **Non‑technical user guides**: [`docs/user-guide/README.md`](docs/user-guide/README.md)
- [`docs/AGIJobManager.md`](docs/AGIJobManager.md)
- [`docs/ParameterSafety.md`](docs/ParameterSafety.md)
- [`docs/ops/parameter-safety.md`](docs/ops/parameter-safety.md)
- [`docs/Deployment.md`](docs/Deployment.md)
- [`docs/Security.md`](docs/Security.md)
- [`docs/Testing.md`](docs/Testing.md)
- [`docs/ERC8004.md`](docs/ERC8004.md)
- [`docs/Interface.md`](docs/Interface.md)
  - To regenerate from ABI: `npm run build` then `npm run docs:interface`.
- **ERC‑8004 integration (control plane ↔ execution plane)**: [`docs/erc8004/README.md`](docs/erc8004/README.md)
- **AGI.Eth Namespace (alpha)**:
  - User guide: [`docs/namespace/AGI_ETH_NAMESPACE_ALPHA.md`](docs/namespace/AGI_ETH_NAMESPACE_ALPHA.md)
  - Quickstart: [`docs/namespace/AGI_ETH_NAMESPACE_ALPHA_QUICKSTART.md`](docs/namespace/AGI_ETH_NAMESPACE_ALPHA_QUICKSTART.md)
  - Identity gating appendix: [`docs/namespace/ENS_IDENTITY_GATING.md`](docs/namespace/ENS_IDENTITY_GATING.md)
  - FAQ: [`docs/namespace/FAQ.md`](docs/namespace/FAQ.md)
