# Operating qualification and capacity planning

The 10,000-offer experiment identified three bottlenecks worth testing in actual
operations: workflow queues, settlement holds, and review errors shared by
multiple Nodes. Its costs, demand and competence are assumptions. It did not
qualify a Mac, model, account or deployed contract.

## What this edition implements

- Workforce policy `agi-workforce-policy/v2` retains every V1 commissioning,
  signature, source/runtime, cash-settlement and security gate, and adds the
  operating limits below. V1 remains readable for historical assessment. The
  updated private native runner requires V2 for **new production grants**.
- Whole-project time admission reserves the declared Agent and dependent Node
  work, including a 30-second margin per unfinished stage. It runs before a new
  project reservation and before additional grants. Restart preserves original
  reservations and completed stages. A schedule rejection never authorizes
  retries, drops an obligation or changes its deadline.
- A read-only capacity planner explains reviewer shortages, occupied slots,
  human backlog and the ordinary reviewed-settlement ceiling. It never modifies
  an instance, creates a grant or bypasses qualified admission.

The private native-to-chain payment handoff and general automated moderation
remain outside this release's implemented scope. The hypothetical automation
case in the experiment is not promoted to production capability.

## V2 policy fields

Keep all existing [workforce policy fields](WORKFORCE_QUALIFICATION.md), change
`schema` to `agi-workforce-policy/v2`, and add `operatingLimits`:

```json
{
  "minimumNetUSDCByRole": {"agent": "0", "reviewer": "0"},
  "maximumHumanSecondsPerUsefulJob": 120,
  "minimumUsefulRateLower95": 0.7,
  "minimumCorrectReviewRateLower95": 0.8,
  "minimumCasesPerCohort": 20,
  "maximumCohortFalseAcceptanceRate": 0.05,
  "maximumLossRate": 0.1,
  "cohorts": ["spreadsheet-held-out", "document-held-out"]
}
```

These are illustrative limits, not recommended production thresholds. Set them
before collecting evaluation results; independent reviewers must approve the
actual scope and acceptable failure costs. All policy changes alter its hash
and require fresh matching signed attestations.

Each declared evaluation cohort must contain at least `minimumCasesPerCohort`
Agent engagements, valid Node deliveries and invalid Node deliveries. Every
evaluation case must belong to a declared cohort. Use a case's existing `group`
field; calibration and evaluation group identifiers must remain disjoint.

For every cohort, the gate checks a Wilson lower bound on useful Agent outcomes
and correct Node verdicts, the raw false-acceptance fraction, and separate Agent
and Node net cash floors. Failed work and abstentions remain in their respective
denominators. Each role must also meet its cash floor and maximum loss fraction
across **all** calibration and evaluation engagements. Agent profit cannot cover
a losing Node role. These are role/cohort aggregates, not proof every individual
operator profits; retain participant-specific admission limits as well.

Supervision is the sum of evaluation Agent and Node human seconds divided by
useful Agent completions. No useful completions means rejection. This covers
only the recorded workflow; zero logged time does not prove no human work.

All corpus specification hashes must be in `allowedSpecSha256`; every authorized
hash must have evaluation cases for both roles. Qualification cannot silently
extend to an untested specification. Outcome/cost/settlement commitments and
independent signed attestations remain required. Synthetic evidence never passes
the observed-evidence gate.

Cohort labels and separate machines do not establish independent ownership or
independent errors. Use independently established outcomes, deliberately plausible
incorrect deliveries, differing failure modes and evidence of conflicts of
interest. Wilson bounds assume independence; the additional cohort gates detect
some pooled masking but are not a statistical correction for arbitrary correlation.

## Plan a fleet before assigning work

```sh
npm run workforce:plan -- examples/capacity-plan.json
```

The example is a synthetic one-Agent/one-Node setup. Its report correctly shows
that one reviewer cannot cover the default three-vote policy. Supply actual
reviewed instance terms and current actor/backlog observations in a private copy.
The planner trusts these inputs and always returns `authorization: NONE`.

`terms` supplies `maxActiveJobsPerAgent`, `requiredApprovals`,
`requiredDisapprovals`, `voteQuorum`, `reviewSeconds` and `challengeSeconds`.
The required pool conservatively covers the largest of the three vote thresholds.
Each Agent declares an ID and active-job count; each Node declares an ID,
controller, credential and failure domain. Duplicate Node controllers or
credentials are rejected. Shared failure domains produce an explicit warning.

`human` supplies daily available seconds and queued handling seconds. `job`
supplies remaining seconds, Agent and review seconds, incremental human seconds,
execution queue seconds and a positive reserve. The conservative forecast includes
a full human shift wait whenever human work is required. It assumes declared daily
capacity repeats; it cannot prove staffing availability. The slot ceiling assumes
ordinary reviewed settlements, excluding early buyer acceptance and adverse exits.

No simulated setting is automatically installed. Three active jobs and a seven-day
review period constrain throughput independently of model speed; shortening review
or lowering quorum also changes protections and needs separate analysis.

## Reproduce and replace assumptions

See the [experiment](../../experiments/workforce-10000/README.md). Commission the
actual Mac accounts, apps, providers, restart paths and independently controlled
reviewers. Replace guessed task time, costs, human effort and error distributions
with observed records before expanding intake. Keep all failures and deferred
claims; a terminal job is not proof every beneficiary received cash.
