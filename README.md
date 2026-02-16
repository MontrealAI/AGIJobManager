# AGIJobManager ALPHA v0

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Solidity](https://img.shields.io/badge/solidity-0.8.19-363636.svg)](contracts/AGIJobManager.sol)
[![Truffle](https://img.shields.io/badge/truffle-5.x-3fe0c5.svg)](https://trufflesuite.com/)

AGIJobManager is an owner-operated escrow + moderation contract for AGI job workflows. It is built so users can complete the full lifecycle directly on Etherscan (Read/Write tabs), using only a wallet.

## Start here

- Etherscan user guide (all roles): [`docs/ETHERSCAN_GUIDE.md`](docs/ETHERSCAN_GUIDE.md)
- Owner/operator runbook: [`docs/OWNER_RUNBOOK.md`](docs/OWNER_RUNBOOK.md)
- Moderator runbook: [`docs/MODERATOR_RUNBOOK.md`](docs/MODERATOR_RUNBOOK.md)
- Verification guide: [`docs/VERIFY_ON_ETHERSCAN.md`](docs/VERIFY_ON_ETHERSCAN.md)
- FAQ: [`docs/FAQ.md`](docs/FAQ.md)

## Roles (plain language)

- **Employer**: funds escrow, creates jobs, can cancel before assignment, and can finalize/dispute after completion request.
- **Agent**: applies to jobs, posts bond if configured, and submits completion URI.
- **Validator**: posts per-vote bond and votes approve/disapprove during review.
- **Moderator**: resolves active disputes using `resolveDisputeWithCode`.
- **Owner**: configures system parameters, risk controls, authorization, ENS wiring, and treasury withdrawals (subject to escrow solvency guards).

## Trust model (explicit)

This system is **not trustless**. The owner has privileged controls, including:
- pause/unpause intake and settlement (`pause`, `setSettlementPaused`),
- role governance (allowlists, blacklists, moderators),
- parameter updates (quorum, thresholds, review windows, bond/slash settings),
- ENS and identity wiring,
- treasury withdrawal via `withdrawAGI`, limited by `withdrawableAGI` and pause guards.

Users should assume this is a transparent but centrally operated protocol.

## One-screen quickstart (Etherscan)

1. On AGI token contract: `approve(AGIJobManager, exactAmount)`.
2. Employer: `createJob(jobSpecURI, payout, duration, details)`.
3. Agent: `applyForJob(jobId, subdomain, proof)`.
4. Agent: `requestJobCompletion(jobId, jobCompletionURI)`.
5. Validators: `validateJob` / `disapproveJob`.
6. Employer/anyone: `finalizeJob(jobId)` when eligible.
7. If contested: `disputeJob(jobId)` then moderator `resolveDisputeWithCode`.

## Tiny glossary

- **jobId**: numeric job identifier.
- **payout**: escrowed AGI amount in base units.
- **duration**: work deadline window in seconds from assignment.
- **review window**: `completionReviewPeriod` voting window.
- **quorum**: minimum combined votes for non-dispute finalization path.
- **bonds**: AGI staked by agents/validators/disputants.
- **slashing**: validator bond penalty on the incorrect side.


## Documentation

- docs index: [`docs/README.md`](docs/README.md)
- quintessential flow: [`docs/QUINTESSENTIAL_USE_CASE.md`](docs/QUINTESSENTIAL_USE_CASE.md)
- regenerate docs: `npm run docs:gen`
- check docs: `npm run docs:check`
- enforce repo policy: `npm run check-no-binaries`
