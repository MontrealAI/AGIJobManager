# AGIJobManager

AGIJobManager is an owner-operated on-chain job escrow contract with validator voting and moderator dispute resolution. It is designed so users can operate directly from Etherscan (`Read Contract` / `Write Contract`) with a browser wallet.

## Start here

- Etherscan step-by-step guide: [`docs/ETHERSCAN_GUIDE.md`](docs/ETHERSCAN_GUIDE.md)
- Owner/operator runbook: [`docs/OWNER_RUNBOOK.md`](docs/OWNER_RUNBOOK.md)
- Moderator runbook: [`docs/MODERATOR_RUNBOOK.md`](docs/MODERATOR_RUNBOOK.md)
- Verification guide: [`docs/VERIFY_ON_ETHERSCAN.md`](docs/VERIFY_ON_ETHERSCAN.md)
- FAQ: [`docs/FAQ.md`](docs/FAQ.md)

## Roles (plain language)

- **Employer**: funds jobs, creates jobs, can cancel before assignment, and finalizes/disputes after completion request.
- **Agent**: authorized worker who applies, may post a bond, and submits completion evidence.
- **Validator**: authorized reviewer who votes approve/disapprove during review.
- **Moderator**: resolves active disputes with `resolveDisputeWithCode`.
- **Owner**: system operator with privileged controls and treasury authority bounded by on-chain solvency checks.

## Explicit trust model

This protocol is **operator-managed, not trustless governance**. The owner can:
- pause/unpause intake (`pause`, `unpause`, `pauseAll`, `unpauseAll`),
- pause/unpause settlement (`setSettlementPaused`),
- change core risk/timing params,
- manage allowlists, Merkle roots, blacklists, moderators,
- configure ENS integration and tokenURI routing,
- lock identity config permanently (`lockIdentityConfiguration`),
- withdraw only non-escrow AGI via `withdrawAGI` constrained by `withdrawableAGI`.

Users should assume an actively operated escrow system and always read current config in Etherscan before transacting.

## One-screen quickstart (Etherscan only)

1. AGI token contract: `approve(AGIJobManager, amount)`.
2. Employer: `createJob(jobSpecURI, payout, duration, details)`.
3. Agent: `applyForJob(jobId, subdomain, proof)`.
4. Agent: `requestJobCompletion(jobId, jobCompletionURI)`.
5. Validators: `validateJob` / `disapproveJob`.
6. Employer: `finalizeJob(jobId)` when eligible.
7. If contested: `disputeJob(jobId)` then moderator `resolveDisputeWithCode`.

## Tiny glossary (Etherscan labels)

- **jobId**: numeric job identifier.
- **payout**: escrowed token amount in base units.
- **duration**: seconds allowed from assignment to completion request.
- **review window**: `completionReviewPeriod` after completion request.
- **quorum**: minimum validator participation (`voteQuorum`).
- **bonds**: staked AGI (agent/validator/dispute).
- **slashing**: bond penalty applied to wrong-side participants.

## Tooling and CI entrypoints

```bash
npm ci
npm run build
npm test
npm run lint
npm run size
npm run forge:test
```

`npm test` is the canonical repository entrypoint and runs Truffle compile/tests, additional Node tests, and contract size checks.
