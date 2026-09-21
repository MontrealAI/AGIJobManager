# v1.4.0 — Lifecycle economics and qualified admission

A favorable settlement calculation is insufficient to qualify a new commitment. v1.4.0 adds explicit lifecycle stresses, signed qualification verification and current canonical economic observations while preserving the deployed contract behavior.

## Download

- [AGIJobManager-v1.4.0-COMPLETE.zip](https://github.com/MontrealAI/AGIJobManager/releases/download/v1.4.0/AGIJobManager-v1.4.0-COMPLETE.zip): extract and open `START_HERE.md`.
- [Standalone USDC console](https://github.com/MontrealAI/AGIJobManager/releases/download/v1.4.0/agijobmanager-usdc.html).
- [Checksums](https://github.com/MontrealAI/AGIJobManager/releases/download/v1.4.0/SHA256SUMS.txt) and [manifest](https://github.com/MontrealAI/AGIJobManager/releases/download/v1.4.0/RELEASE_MANIFEST.json).

## Changes

- **Lifecycle economics:** `npm run economics:lifecycle -- --example` models named participants, changing reviewer participation, non-delivery, cancellation and unavailable payments, alongside the existing settlement outcomes. Required zero-weight stresses include dilution to 50 approvals, absence, adverse votes and full cash-horizon unavailability. Returned principal remains excluded from earnings.
- **Signed qualification verification:** Ed25519 envelopes bind a job, exact specification, operator policy, class, evidence digest, sample/freshness requirements, participant identities, all-in cost assumptions and economic terms. Operator-owned expected-margin and loss thresholds apply to every declared participant.
- **Separate budget constraints:** aggregate conservative capital plus cost, cumulative modeled costs, job count and conservatively priced native gas limits are checked independently of expected profit. The caller must supply verified observations and reserve atomically; CLI output has no transaction authority.
- **Canonical observations:** the read-only adapter requires two clients, native Ethereum/Sepolia USDC, six decimals, fresh heads and EIP-1898 canonical hash reads. Reorgs, stale data, disagreement and unsupported reads fail closed. Deployment code pins and signing controls remain the integrating runner's responsibility.
- **Integration guide:** exact schemas and boundaries explain evidence retention, controller independence, durable reservations, budget metering, requalification and continued recovery of already-committed obligations.

Read `source/docs/OPERATIONS/QUALIFIED_ADMISSION.md` and `source/docs/qualification/V140_QUALIFIED_ADMISSION.md`. Existing economics and settlement-status commands remain available and compatible.

## Boundaries

This public release supplies reusable admission primitives, not an autonomous signing service or measured production qualification dataset. Signatures authenticate an issuer's assertions; they do not prove employer value, demand, success probabilities, independent control or actual future costs. Teaching examples are hypothetical. Required stresses are not exhaustive, and a passing result does not guarantee profit, recovery, zero human work or production capacity. Protected unpaid claims remain obligations, not settled receipts.

All Solidity sources, ABI/bytecode inputs, eight linked libraries, payout rules, dependency resolutions, legal notices and historical releases remain unchanged. Existing jobs and settings stay with their original managers. Publication performs no deployment or public-chain transaction.

**Private AGI Agent, AGI Node and fleet implementations, configurations and artifacts are excluded from GitHub and this public archive.**

## Qualification

Frozen source: `78fe5e4b0962f4776bb829413c2f3f1e7bc8d755`, tree `2004cbefa276c42cd2f36e48a7e5522db033c5cb`; source PR [#1540](https://github.com/MontrealAI/AGIJobManager/pull/1540). Local checks passed 589 contract/tool cases, including 21 new admission tests, and 23 pinned native-USDC/ENS cutover cases. Documentation, UI generation and 35 mocked standalone console checks passed.

Publication requires all five exact-source CI workflows, all eight required jobs and their actual checkout logs, preserved historical evidence, reproducible packaging and uploaded-asset digest verification. See `VALIDATION.md`. This is bounded software qualification, not an independent audit or absolute quality certification.
