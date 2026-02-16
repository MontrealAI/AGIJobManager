# AGIJobManager

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![CI](https://github.com/MontrealAI/AGIJobManager/actions/workflows/ci.yml/badge.svg)](https://github.com/MontrealAI/AGIJobManager/actions/workflows/ci.yml)

AGIJobManager is an owner-operated on-chain escrow workflow for AI jobs: employers fund jobs, agents do work, validators vote, moderators resolve disputes, and the contract settles payouts/refunds.

## Start here

- Etherscan step-by-step guide: [`docs/ETHERSCAN_GUIDE.md`](docs/ETHERSCAN_GUIDE.md)
- Owner/operator runbook: [`docs/OWNER_RUNBOOK.md`](docs/OWNER_RUNBOOK.md)
- Moderator runbook: [`docs/MODERATOR_RUNBOOK.md`](docs/MODERATOR_RUNBOOK.md)
- Etherscan verification guide: [`docs/VERIFY_ON_ETHERSCAN.md`](docs/VERIFY_ON_ETHERSCAN.md)
- User FAQ: [`docs/FAQ.md`](docs/FAQ.md)

## Roles (plain language)

- **Employer**: funds escrow and creates jobs, can cancel before assignment, can finalize/dispute once completion is requested.
- **Agent**: applies for jobs through allowlist/Merkle/ENS authorization, may post a bond, requests completion with a URI.
- **Validator**: authorized reviewer that votes approve/disapprove and may post a per-vote bond.
- **Moderator**: resolves active disputes with `resolveDisputeWithCode`.
- **Owner**: configures risk controls and operations.

## Trust model (important)

This is **not trustless governance**. The owner is privileged and can:

- pause/unpause intake (`pause`, `unpause`) and settlement (`setSettlementPaused`, `pauseAll`, `unpauseAll`),
- set core risk parameters (quorum, approval/disapproval thresholds, bond/slash params, windows, limits),
- manage moderators, allowlists (`additionalAgents`, `additionalValidators`) and blacklists,
- update identity wiring before lock (AGI token, ENS registry, NameWrapper, roots, ENSJobPages),
- withdraw only treasury surplus with `withdrawAGI` (while paused, solvency-checked via `withdrawableAGI`),
- call rescue functions (high risk; runbook process required).

Users should assume a business-operated escrow with transparent on-chain controls.

## One-screen quickstart (Etherscan)

1. **Approve AGI** on the AGI token contract: `approve(AGIJobManagerAddress, amountInBaseUnits)`.
2. Employer: **create job** with `createJob(jobSpecURI, payout, duration, details)`.
3. Agent: **apply** with `applyForJob(jobId, subdomain, proof)`.
4. Agent: **request completion** with `requestJobCompletion(jobId, completionURI)`.
5. Validators: vote with `validateJob(...)` / `disapproveJob(...)` during review window.
6. Employer/agent: **finalize** with `finalizeJob(jobId)` after windows; if needed call `disputeJob(jobId)`.
7. Moderator (if disputed): resolve with `resolveDisputeWithCode(jobId, code, reason)`.

## Glossary

- **jobId**: integer ID for each job.
- **payout**: escrow amount in token base units (usually 18 decimals).
- **duration**: seconds from assignment to expected completion.
- **completion review window**: `completionReviewPeriod` after completion request.
- **quorum**: `voteQuorum`, minimum total validator votes for normal finalize logic.
- **bond**: stake posted by agent/validator/dispute initiator.
- **slashing**: bond penalty applied to validators on incorrect side.

## Tooling for low-touch operations

- Merkle root/proof generator: `scripts/merkle/export_merkle_proofs.js`
- Etherscan paste helper: `scripts/etherscan/cli.js`
- Offline job-state advisor: `scripts/advisor/job_state_advisor.js`

See examples in [`docs/ETHERSCAN_GUIDE.md`](docs/ETHERSCAN_GUIDE.md).

## Documentation

- Documentation index: [`docs/README.md`](docs/README.md)
- Core walkthrough: [`docs/QUINTESSENTIAL_USE_CASE.md`](docs/QUINTESSENTIAL_USE_CASE.md)

Docs maintenance commands:

```bash
npm run docs:gen
npm run docs:check
node scripts/check-no-binaries.mjs
```
