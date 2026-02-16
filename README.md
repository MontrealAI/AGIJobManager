# AGIJobManager

AGIJobManager is an owner-operated on-chain job escrow and settlement contract for employer/agent workflows with validator voting and moderator dispute resolution.

## Start here

- Etherscan role guide: [`docs/ETHERSCAN_GUIDE.md`](docs/ETHERSCAN_GUIDE.md)
- Owner/operator runbook: [`docs/OWNER_RUNBOOK.md`](docs/OWNER_RUNBOOK.md)
- Moderator runbook: [`docs/MODERATOR_RUNBOOK.md`](docs/MODERATOR_RUNBOOK.md)
- Verification guide: [`docs/VERIFY_ON_ETHERSCAN.md`](docs/VERIFY_ON_ETHERSCAN.md)
- FAQ: [`docs/FAQ.md`](docs/FAQ.md)

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


## Documentation

- Documentation index: [`docs/README.md`](docs/README.md)
- End-to-end walkthrough: [`docs/QUINTESSENTIAL_USE_CASE.md`](docs/QUINTESSENTIAL_USE_CASE.md)

Docs maintenance commands:

```bash
npm run docs:gen
npm run docs:check
npm run check:no-binaries
```

Binary guard helper script name: check-no-binaries.
