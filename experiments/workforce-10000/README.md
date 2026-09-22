# Reproducible 10,000-offer workforce experiment

This is a synthetic planning experiment based on the v1.10.0 settlement rules.
It is included in the next release to preserve the evidence behind its operating
changes. It runs no model, Mac application, wallet or blockchain transaction.
No retainer strategy is introduced. A simulation cannot issue production authority.

From the repository root, with Python 3.11 or later:

```sh
npm run test:simulation
npm run simulate:workforce
```

The run writes to `build/workforce-10000`, uses 10,000 distinct offers across
11 job classes, repeats 12 scenarios over 20 seeds, and performs 20 additional
one-variable sensitivity runs. This totals 2.6 million evaluations of the fixed
offer cohort, not 2.6 million unique jobs. It includes 90 intake days and a 60-day
recovery tail. Every canonical scenario saves 10,000 rows and a hash-chained event
ledger. Other repetitions retain aggregate results. No external dependencies are
needed for simulation or its sixteen regression tests.

The committed CANONICAL, MONTE_CARLO, PAIRED_DIFFERENCES and SENSITIVITY JSON files
are the previous experiment's reference outputs. Compare generated files under
`build/workforce-10000/results`. Source provenance pins the release used to check
settlement arithmetic; it is not a claim these hypothetical machines were qualified.
The simulator's default output-directory expression was adjusted for this repository
layout; the experiment's event logic, inputs and random draws are unchanged.

## Findings

| Scenario: eight Agents/four Nodes | Useful settlements | Incorrect paid work | Human hours |
| --- | ---: | ---: | ---: |
| Contract defaults | 252 | 1 | 36.2 |
| Bounded planning reference | 1,437 | 13 | 189.2 |
| Eight human hours available daily | 4,229 | 34 | 592.0 |
| Hypothetical bridge plus automated moderation | 4,008 | 32 | 81.7 |

These are canonical-seed results. Across twenty paired runs, unscreened intake
adds only 4.65 useful jobs on average, with a central 95% range of -50.23 to 48.15,
and adds 4,628.34 USDC-equivalent resource cost. This does not demonstrate a
throughput advantage for either policy; the modeled cost/value mix improves with
screening. Correlated review errors raise incorrect payments from 34 to 86 in
matched canonical scenarios. These ranges describe model variation, not empirical
confidence in actual economic or computer-use performance.

Reference resource cost is 36,967.02 USDC-equivalent, using assumed compute,
transaction, human, machine and capital costs. Employer value is invented, not
observed revenue or savings. Capital cost approximates deposits held from admission
to settlement and excludes delayed-claim financing. The future-automation scenarios
exclude separately priced additional automation inference; their financial benefit
is optimistic. Neither automatic private settlement handoffs nor general automated
moderation was implemented by the experiment.

The original experiment separately passed sixteen simulator tests, 25,101 parity
comparisons against the released settlement calculator, reconciliation of 120,000
canonical job rows and 701,215 events, and a deterministic reference replay. Those
are software checks by the same author, not external security assurance. New release
qualification is recorded separately in its release evidence.
