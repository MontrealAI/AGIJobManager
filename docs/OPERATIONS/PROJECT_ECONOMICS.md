# Project economics before committing resources

A high job price does not make every stage or participant profitable. An Agent
or Node can spend on several stages and receive nothing when the parent result
fails. This planner makes those cases explicit, without adding retainers or
assuming intermediate payments.

From the public checkout or any current private companion:

```sh
npm run workforce:economics -- examples/project-economics-100.json
npm run workforce:economics -- examples/project-economics-1000.json
npm run workforce:economics -- examples/project-economics-10000.json
```

The $100 teaching example meets its declared limits. The $1,000 example rejects
negative Node means and excessive losses. The $10,000 example shows how positive
Node means can coexist with excessive losing engagements. Exit status **0** means
the assumptions meet the declared limits, **2** means a limit rejects the plan,
and **1** means malformed input. None authorizes execution or spending.

## Interpret the examples correctly

Prices, durations implicit in stage costs, success weights and budgets are
illustrative assumptions, not observed offers or calibrated forecasts. These
small scenarios are not a rerun or extract of the 10,000-job studies. They model
one, two and four work/review rounds, an Agent and three independent reviewer
identities, a successful payment, rejection at the end, and early failure.
Independence is an operator assumption, not verified by this tool.

The sample final cash uses the default 52% Agent share and a conservative equal
third of the 8% Node allocation. Actual allocations, eligible voters, retained
bonds, gas and settlement branches must be read from the real instance. Zero
sample deposits describe the separate native-stage workflow; they do not mean
on-chain work is bond-free. Add actual escrowed bonds and their possible cash
returns before using this model for an on-chain job. Private-to-chain settlement
is not automatically performed by this planner or the native runner.

## Input contract

Use `agi-project-economics/v1`, `measurementKind: assumptions`, decimal-string
`jobPriceUSDC`, and the following arrays. Every field is required; unknown fields
are rejected. Monetary amounts have at most six decimal places and no exponent.

| Array | Fields and interpretation |
| --- | --- |
| `participants` | Unique `id`, `role` (`agent` or `reviewer`), `availableCapitalUSDC`, `minimumExpectedNetUSDC`, `maximumLossProbabilityBps`, `maximumScenarioLossUSDC` |
| `stages` | Unique `id`, `participant`, `dependencies`, `costReserveUSDC`, `depositUSDC`. Acyclic dependencies; every participant has a stage. |
| `scenarios` | Unique `id`, positive `probabilityBps`, and one `stages` row for **every** stage. Weights sum to 10,000. Include at least one actual failed stage. |
| Scenario stage | `id`, `status` (`complete`, `failed`, `not-started`), `costUSDC`, `receiptsUSDC`. Unstarted stages have zero cash; a started stage requires completed dependencies. |

`receiptsUSDC` is cash received, including any returned deposit. It excludes
escrow, hoped-for compensation, unrealized buyer value and uncollected claims.
For a started stage, net cash is receipts minus deposit minus cost. Include
compute, infrastructure, gas, failed attempts and allocated human overhead in
costs; document the allocation and do not count the same cost twice. A completed
intermediate stage may have zero receipts. A retry must be included explicitly
within declared costs or as a distinct stage; it is not free.

Capital reserves sum **every** stage's cost ceiling and deposit, with no reuse of
future receipts. Actual costs above a stage ceiling make the input invalid.
Each participant independently faces expected-net, loss-probability, worst-case
loss and capital limits. Positive Agent profit cannot cover a Node's rejection.
Expected means use exact micro-USDC arithmetic, rounded down for display;
threshold comparisons use the unrounded integer numerator.

The report includes the input hash, participant results, every scenario's net
cash and explicit rejection codes. Keep it with the private frozen pilot plan.
No network request, wallet access, grant or transaction occurs. Scenario
probabilities are supplied; the tool cannot prove they are accurate, disjoint or
exhaustive. Review absent failure modes and repeat the plan with adverse
assumptions. Use [operating qualification](OPERATING_QUALIFICATION.md) for signed
observed results and the [pilot guide](VALUE_TIER_PILOT.md) for collecting them.
