# Astra review capacity and pilot targets

The September 23 Work + Astra M1 study is a synthetic planning experiment, not measured Work, OpenClaw, Mac, customer or blockchain operation. Its ten workload templates are repeated across 10,000 offers. The independently checked review archive has SHA-256 `e5bd47e7e0fd8a0c247909ca88a8157ce3f7a65cfe151b203b09ad2b7bd644f8`; the supplied original package has SHA-256 `845654424b39dde470d79468570a457dc63072831f0a7f32f7397eccacde48b4`. Those archives remain separate from this public source release.

| Synthetic case, canonical seed | Useful / admitted | Human minutes / useful | Losing Agent engagements | Losing Node engagements |
| --- | ---: | ---: | ---: | ---: |
| Fleet reference | 137 / 446 (30.7%) | 79.8 | 308 / 446 (69.1%) | 588 / 948 (62.0%) |
| Reserved intake | 88 / 132 (66.7%) | 38.5 | 45 / 132 (34.1%) | 121 / 393 (30.8%) |
| Doubled *assumed* allowance | 300 / 501 (59.9%) | 43.1 | 202 / 501 (40.3%) | 554 / 1,441 (38.4%) |

Reservation improved completion per admitted job while reducing useful volume from 137 to 88. It is an admission control tradeoff, not a proven optimal policy. The review found 273 of 278 reference intermediate review failures had fewer than three recorded non-absent votes at the last intermediate stage. That is a participation and schedule diagnostic, not proof that the submitted work was good. Role losses are engagements, not distinct participants; fees owed but unpaid and fixed overhead need separate accounting.

## Reserve actual reviewer windows before commitment

The existing `workforce:plan` command estimates headcount and a single job's deadline; it does not book reviewer time across jobs. `workforce:reserve` schedules the declared review duration for each independent reviewer, in deadline order, honoring existing reservations, work-ready time, challenge time and recovery margin. It rejects a job without enough reviewers, distinct declared failure domains when required, or deadline headroom. Rejected jobs leave no partial bookings. It never signs, spends, posts, reserves on a live runtime, or changes the contract's quorum.

```bash
npm run workforce:reserve -- examples/review-reservation.json
```

Enter actual Unix seconds, independent control and credentials, existing reservations, independently estimated review durations, remaining deadlines and realistic margins for a real planning exercise. The example's small timestamps are illustrative. A planner's `measurementKind: observed` is only a label supplied by the caller, not proof of authenticity. Refresh against the private fleet's actual journals and on-chain state before each decision. Add Agent work, allowance, human queue, collateral, and recovery checks from the existing qualification flow. No one-Node path is treated as a three-reviewer job.

## Score the next pilot without hiding weak dimensions

`workforce:pilot` reports six independent checks. The sample threshold is more than 80% useful per admitted job, less than 15 human minutes per useful result, at most 25% losing Agent and Node engagements each, zero defects among at least ten **audited** settlements, and a 95% Wilson upper bound of at most 5% judgment errors among at least 100 independently scored reviews. The sample sizes and last three limits are adjustable candidate acceptance criteria, not observed performance or a claim that five percent is safe in every job class. Wilson sampling bounds do not cover correlated errors or unreliable ground truth. Run cohorts separately and retain denominators and outcome labels.

```bash
npm run workforce:pilot -- examples/astra-pilot-reference.json
```

The example deliberately sets `settlementsAudited` and `independentlyScoredReviews` to zero. The study's release-calculator parity audit covers selected transactions, but its 5,244 checks do not provide an independent, cohort-bound settlement-rule audit for this fixture; the study does not supply independently labeled review judgments. Zero evidence fails these gates. `incorrectPaid` remains visible separately and is not relabeled as a settlement-rule defect or review judgment error. The report has `authorization: NONE`, even if a synthetic example meets all six thresholds.

For a measured pilot, freeze the job class and versions, capture offers through final recovery, reconcile payouts and pending claims to contract rules, compare Node votes against an independent deliverable oracle, and record actual human time and cash costs. Use matched conditions when comparing different Agent:Node ratios or allowances. Keep the three-reviewer rule where the posted job requires it; separately test downtime, correlated mistakes, restart, missed review, and withdrawal. Publish cohort counts and uncertainty without claiming a simulated success rate is production capacity.
