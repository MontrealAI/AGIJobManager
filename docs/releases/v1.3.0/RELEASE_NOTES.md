# v1.3.0 — Participant margin and loss screening

Success-case payout percentages do not establish participant profitability. Costs, failed work, uncompensated refunds and lost collateral also matter. This release adds an offline tool that compares explicit economic assumptions against each participant's expected-margin and modeled-loss limits.

## Download

- [AGIJobManager-v1.3.0-COMPLETE.zip](https://github.com/MontrealAI/AGIJobManager/releases/download/v1.3.0/AGIJobManager-v1.3.0-COMPLETE.zip): extract it and open `START_HERE.md`.
- [Standalone USDC console](https://github.com/MontrealAI/AGIJobManager/releases/download/v1.3.0/agijobmanager-usdc.html).
- [SHA256SUMS.txt](https://github.com/MontrealAI/AGIJobManager/releases/download/v1.3.0/SHA256SUMS.txt) and [RELEASE_MANIFEST.json](https://github.com/MontrealAI/AGIJobManager/releases/download/v1.3.0/RELEASE_MANIFEST.json): verify downloads and frozen-source identity.

## What changes

- **Conditional economics:** `npm run economics:screen -- --example` combines the existing contract-tested settlement calculator with supplied outcome weights, outcome-specific costs and employer artifact value. It covers submitted work with a fixed vote split across Agent win, buyer win, explicit acceptance and neutral timeout.
- **Every participating role:** the employer, Agent and each approving/rejecting reviewer group must meet their own supplied expected-net minimum and maximum modeled loss. A profitable Agent does not hide an underfunded reviewer or employer.
- **Exact arithmetic and visible downside:** USDC transfers retain integer micro-units; weighted expectations retain up to twelve decimal places. Returned collateral is excluded from earnings. Every available modeled outcome remains in loss checks, even with zero assigned probability.
- **Usable local reports:** human-readable and JSON output, strict fields, an explicitly hypothetical example and distinct exit codes: 0 within supplied limits, 2 outside limits, 1 invalid/incomplete input. No output grants transaction authority.
- **Operator guidance and regression evidence:** a new guide explains costs, employer value, independence, measurement and the separation between new-admission decisions and existing settlement obligations. Thirteen new regression cases join the existing public tests.

Read `source/docs/OPERATIONS/ECONOMIC_SCREENING.md` and `source/docs/qualification/V130_ECONOMIC_SCREENING.md`. The existing `economics:check` and canonical `settlement:status` tools remain available.

## Scope and compatibility

The new tool has no network or signing capability and requires no dependency installation. Its weights, costs, value and limits are user-supplied assumptions. It does not estimate probabilities, verify live prices or enforce a complete admission system. Pre-submission failures, changing vote populations, unavailable tokens, unresolved delays, custody incidents and portfolio/correlated risks require separate analysis. A result within supplied limits is not a guarantee of profit, useful work, liquidity or deployment readiness.

All Solidity sources, ABI/bytecode inputs, eight linked libraries, payout rules, dependency resolutions, legal notices and historical releases remain unchanged. Package versions and current distribution pointers identify this edition. Existing instances, jobs, agreements and settings stay on their original managers. Publication performs no deployment or public-chain transaction.

**Private AGI Agent, AGI Node and fleet implementations, configurations and private artifacts are excluded.** This public release does not claim to update or qualify those applications.

## Qualification

Frozen source: `434b32c5c7a75b6a03e271c4bdb2c4976a5ef3d4`, tree `130cea014ca15f87017220077f96560f1799626e`; source PR [#1538](https://github.com/MontrealAI/AGIJobManager/pull/1538). Local checks passed 568 contract/tool tests, including the 13 new cases, 23 pinned fork cutover cases and 35 mocked standalone console checks. Documentation, Solidity lint and production UI generation passed.

Publication requires all five exact-source qualification workflows and all eight required jobs, their actual checkout logs, protected-history checks, reproducible packaging and uploaded-asset digest verification. `VALIDATION.md` records the executed checks and CI links. This is bounded software qualification, not an independent audit or an absolute quality certification.
