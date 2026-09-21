# Screen the economics before committing more work

Use this offline tool to test whether a **specified submitted-work scenario** meets each participant's supplied expected-margin and loss limits. It combines the public settlement calculator with explicit outcome weights and costs. It makes no network requests and has no wallet or signing capability.

An economic screen cannot guarantee that everyone wins. Employer demand, artifact value, payment liquidity, independent review and the accuracy of the assumptions still need evidence. A positive expected margin can coexist with substantial losses in individual jobs.

## Try the example

From the repository root, with the documented Node.js version:

```sh
npm run economics:screen -- --example
node scripts/economics/screen.cjs --example --json
```

No dependency installation is needed for this command. Copy `scripts/economics/screen-example.json` to a local working file, replace every assumption and run:

```sh
node scripts/economics/screen.cjs my-screen.json --json > my-screen-report.json
```

The example is a teaching fixture, not recommended pricing or calibrated reliability. Keep private cost, customer and operational data out of public job descriptions, IPFS, GitHub and shared reports. The command reads a local file and prints locally; it does not upload anything.

| Exit | Decision | Meaning |
| --- | --- | --- |
| 0 | `WITHIN_SUPPLIED_LIMITS` | Every applicable participant meets both supplied limits within this conditional model |
| 2 | `OUTSIDE_SUPPLIED_LIMITS` | At least one participant misses its expected margin or exceeds its modeled loss limit; inspect `failures` |
| 1 | No complete report | Invalid input or read/calculation error; do not interpret this as a pass |

**None of these outcomes authorizes a transaction or activates automated admission.** The original `npm run economics:check -- --example` remains available for the four separate settlement counterfactuals.

## Supply defensible inputs

Use the exact JSON keys in the example. Unknown or missing fields are errors. Monetary inputs are nonnegative decimal strings with at most six decimal places; weights are integers in parts per million and must sum to exactly 1,000,000. Each outcome requires a rationale, including zero-weight outcomes. The schema is version 1 and scope is `submitted-work-fixed-votes`.

| Input | What to supply |
| --- | --- |
| `terms` | Job budget, exact recorded or separately quoted bonds, dispute initiator, posting-time reward percentage, applicable slash rate and fixed approving/rejecting vote counts. The tool does not fetch settings or calculate bond quotes |
| `assumptionSource` | Where the settings, observations, costs, value and weights came from; include the cohort, period and sample limitations. Avoid secrets and personal information |
| `outcomes` | Weights and separate costs/value for Agent win, buyer win, explicit buyer acceptance and neutral timeout. Acceptance must have weight zero when a posted dispute bond makes it unavailable |
| `employerValueUSDC` | Incremental value of the usable artifact relative to the employer's best alternative, supported by agreed measurable criteria; use a conservative amount for unusable or uncertain work |
| `employerCostUSDC`, `agentCostUSDC`, `eachReviewerCostUSDC` | All-in costs in each outcome, including acquisition, failed attempts, revisions, inference, gas, human handling, infrastructure, capital carrying cost and relevant taxes. A single reviewer cost applies to every participating reviewer |
| `policy` | A minimum expected net and maximum modeled scenario loss for the employer, Agent and each member of both reviewer groups. Empty reviewer groups are explicitly not applicable |

These are **joint outcome weights conditional on the stated submitted work and fixed votes**, not independent per-reviewer accuracy estimates or the success rate of all offered jobs. They are not statistically estimated by the tool. Use pilot cohorts and conservative sensitivity cases; rerun with adverse gas, higher review cost, lower employer value, more failure, different vote splits and longer capital lockup. Do not turn an uncalibrated model confidence score into a probability.

## What the calculation means

For each participant and outcome, net is earned receipts minus their own deposits and supplied costs. The employer additionally receives the supplied artifact value. Thus returned bonds are capital returned, not income. The expected net is the weighted sum of those outcome nets; it is not an annualized return. Contract settlements retain integer micro-USDC arithmetic, while weighted results retain up to twelve decimal places without rounding a failing comparison into a pass.

The loss check uses the worst net among **all available modeled outcomes, including those assigned zero probability**. This prevents optimistic weights from hiding a slash or uncompensated refund outcome. `assumedLossWeightPpm` is only the summed supplied weight of negative-net outcomes. `maximumModeledLossUSDC` is a net economic loss under those value/cost assumptions, not a measure of all capital at risk or a bound on every real-world loss.

For an ordinary 1,000 USDC success with an 8% budget and three approving reviewers, the base validator pool is 80 USDC. Each receives 26.666666 USDC, with two micro-USDC of rounding remainder going to the Agent. The Agent's base share is about 520 USDC; the two settlement wallets receive 300 and 100. Different votes, outcomes, settings and slashes change these receipts. On an adjudicated losing vote, a recorded 150 USDC reviewer bond and 8,000-bps slash imply a 120 USDC loss—about 4.5 such gross rewards, before costs. Explicit buyer acceptance does not slash dissent; neutral timeout returns own bonds and pays no work/review reward. See the [payout specification](../USDC_PAYOUT_SPLIT.md) and [existing economics guidance](../qualification/BUYER_ECONOMICS_FOLLOWUP.md).

## Boundaries and operating decisions

This screen omits pre-submission expiry/cancellation, variable reviewer participation, unresolved or indefinite delays, unavailable tokens, custody compromise, correlated failures and portfolio capital constraints. A receipt can be a reserved payment claim rather than spendable USDC. Inspect the separate [settlement and recovery report](SETTLEMENT_RECOVERY.md). Slashing follows the contract outcome; alignment with that outcome is not proof of objective correctness or independence. Machines or models under common control do not become independent validators by using different hardware.

A complete admission service also needs live verified terms, qualified job classes, enforceable spending authority, independent reviewers, liquidity and aggregate exposure limits, calibrated cost/outcome data, clear exception ownership and monitoring. This release does not add such a service to private Agent, Node or fleet applications. It supplies a public calculation and decision aid.

Before commitment, reject, reprice or narrow work when any party's economics or evidence is inadequate. After commitment, follow the agreed terms and settlement/recovery obligations: adverse margins do not authorize changing an accepted job's price or withholding a valid payment. A pause on new admissions should preserve recovery of existing obligations.

Track realized employer value separately from payment, and record actual costs, acceptance/dispute rates, review abstentions, bond losses, gas, outstanding collateral, human minutes and unpaid claims. Keep projections separate from measured outcomes. No current model price, subscription entitlement, market demand or hardware capacity is assumed by the software; use the applicable provider agreement and actual usage charges in local estimates.
