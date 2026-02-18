# AGIJobManager

[![CI][ci-badge]][ci-url] [![Security Scan][security-scan-badge]][security-scan-url] [![Security Policy][security-badge]][security-url] [![License][license-badge]][license-url]

AGIJobManager is an owner-operated on-chain job escrow and settlement contract for employer/agent workflows with validator voting and moderator dispute resolution.

## Start here

- Etherscan role guide: [`docs/ETHERSCAN_GUIDE.md`](docs/ETHERSCAN_GUIDE.md)
- Owner/operator runbook: [`docs/OWNER_RUNBOOK.md`](docs/OWNER_RUNBOOK.md)
- Moderator runbook: [`docs/MODERATOR_RUNBOOK.md`](docs/MODERATOR_RUNBOOK.md)
- Verification guide: [`docs/VERIFY_ON_ETHERSCAN.md`](docs/VERIFY_ON_ETHERSCAN.md)
- FAQ: [`docs/FAQ.md`](docs/FAQ.md)
- ENS integration guide: [`docs/INTEGRATIONS/ENS.md`](docs/INTEGRATIONS/ENS.md)
- ENS robustness/runbooks: [`docs/INTEGRATIONS/ENS_ROBUSTNESS.md`](docs/INTEGRATIONS/ENS_ROBUSTNESS.md)
- ENS canonical use case: [`docs/INTEGRATIONS/ENS_USE_CASE.md`](docs/INTEGRATIONS/ENS_USE_CASE.md)

## Roles (plain language)

- **Employer**: funds jobs, assigns by accepting an applicant flow, can cancel before assignment, can finalize/dispute after completion request.
- **Agent**: applies to jobs (allowlist/Merkle/ENS authorization), may post a bond, submits completion URI.
- **Validator**: authorized voter that approves/disapproves completed work during review.
- **Moderator**: resolves disputes with `resolveDisputeWithCode`.
- **Owner**: configures risk parameters, pause controls, allowlists/blacklists/moderators, ENS wiring, and treasury withdrawal constrained by solvency.

## Trust model (explicit)

This system is **not trustless governance**. The owner is privileged and can:
- pause/unpause intake (`pause`, `unpause`, `pauseAll`, `unpauseAll`),
- pause/unpause settlement (`setSettlementPaused`),
- change core risk and timing parameters,
- manage allowlists, Merkle roots, and blacklists,
- add/remove moderators,
- change ENS/token identity configuration until `lockIdentityConfiguration()` is used,
- withdraw only non-escrow AGI via `withdrawAGI` (bounded by `withdrawableAGI`).

Users should assume an operator-managed escrow model with transparent on-chain controls.

## One-screen quickstart (Etherscan)

1. On AGI token contract: `approve(AGIJobManager, amount)`.
2. Employer: `createJob(jobSpecURI, payout, duration, details)`.
3. Agent: `applyForJob(jobId, subdomain, proof)`.
4. Agent: `requestJobCompletion(jobId, jobCompletionURI)`.
5. Validators: `validateJob` / `disapproveJob` during review period.
6. Employer: `finalizeJob(jobId)` when eligible; if contested, `disputeJob(jobId)` and moderator resolves.

## Glossary (Etherscan terms)

- **jobId**: numeric job identifier.
- **payout**: escrowed amount in token base units.
- **duration**: job duration in seconds.
- **review window**: completion voting period after completion request.
- **quorum**: minimum total validator participation threshold.
- **bond**: staked token amount for agent/validator/dispute initiation.
- **slashing**: bond penalty for wrong-side outcomes.

## Tooling and CI entrypoints

```bash
npm ci
npm run build
npm test
npm run lint
npm run size
```

`npm test` runs: Truffle compile/tests, additional Node tests, and contract size guards.

## Offline helper tooling (Etherscan-first)

- Merkle root + proof export (paste-ready `bytes32[]`):
  ```bash
  node scripts/merkle/export_merkle_proofs.js --input scripts/merkle/sample_addresses.json --output proofs.json
  ```
- Etherscan write-input preparation + unit conversion:
  ```bash
  node scripts/etherscan/prepare_inputs.js --action create-job --payout 1200 --duration 7d --jobSpecURI ipfs://bafy.../job.json --details "Translate legal packet EN->ES"
  ```
- Offline state advisor (no RPC required):
  ```bash
  node scripts/advisor/state_advisor.js --input scripts/advisor/sample_job_state.json
  ```


## Documentation

- Main docs index: [`docs/README.md`](docs/README.md)
- Quintessential end-to-end walkthrough: [`docs/QUINTESSENTIAL_USE_CASE.md`](docs/QUINTESSENTIAL_USE_CASE.md)

## Sovereign Ops Console UI

The repository includes a standalone, institutional UI under [`ui/`](ui/) with deterministic demo mode and security-first operator workflows.

Run the UI in deterministic demo mode (no chain required):

```bash
cd ui
npm ci
NEXT_PUBLIC_DEMO_MODE=1 NEXT_PUBLIC_DEMO_ACTOR=visitor npm run dev
```

UI documentation set:

- [`docs/ui/README.md`](docs/ui/README.md)
- [`docs/ui/OVERVIEW.md`](docs/ui/OVERVIEW.md)
- [`docs/ui/ARCHITECTURE.md`](docs/ui/ARCHITECTURE.md)
- [`docs/ui/JOB_LIFECYCLE.md`](docs/ui/JOB_LIFECYCLE.md)
- [`docs/ui/OPS_RUNBOOK.md`](docs/ui/OPS_RUNBOOK.md)
- [`docs/ui/SECURITY_MODEL.md`](docs/ui/SECURITY_MODEL.md)
- [`docs/ui/DESIGN_SYSTEM.md`](docs/ui/DESIGN_SYSTEM.md)
- [`docs/ui/DEMO.md`](docs/ui/DEMO.md)
- [`docs/ui/TESTING.md`](docs/ui/TESTING.md)

Text-only visual assets:

- Palette SVG: [`docs/ui/assets/palette.svg`](docs/ui/assets/palette.svg)
- Wireframe SVG: [`docs/ui/assets/ui-wireframe.svg`](docs/ui/assets/ui-wireframe.svg)

[![UI CI][ui-ci-badge]][ui-ci-url]

Documentation maintenance commands:

```bash
npm run docs:gen
npm run docs:check
npm run check:no-binaries  # check-no-binaries
```

[ci-badge]: https://img.shields.io/github/actions/workflow/status/MontrealAI/AGIJobManager/ci.yml?branch=main&style=flat-square&label=CI
[ci-url]: https://github.com/MontrealAI/AGIJobManager/actions/workflows/ci.yml
[security-scan-badge]: https://img.shields.io/github/actions/workflow/status/MontrealAI/AGIJobManager/security-verification.yml?branch=main&style=flat-square&label=Security%20Scan
[security-scan-url]: https://github.com/MontrealAI/AGIJobManager/actions/workflows/security-verification.yml
[security-badge]: https://img.shields.io/badge/Security-Policy-blue?style=flat-square
[security-url]: ./SECURITY.md
[license-badge]: https://img.shields.io/github/license/MontrealAI/AGIJobManager?style=flat-square
[license-url]: ./LICENSE
[ui-ci-badge]: https://img.shields.io/github/actions/workflow/status/MontrealAI/AGIJobManager/ui.yml?branch=main&style=flat-square&label=UI%20CI
[ui-ci-url]: https://github.com/MontrealAI/AGIJobManager/actions/workflows/ui.yml
