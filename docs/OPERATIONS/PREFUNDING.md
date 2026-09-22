# Qualify an offer before funding it

v1.6.1 supplies a **pre-funding qualification primitive**. Its purpose is to reject unsuitable work before employer escrow is deposited. It complements the existing Agent and reviewer checks. A passing calculation alone never authorizes a transaction.

The recommended sequence is: verify employer value and each participant's costs; reserve capital and capacity; recheck the exact offer against current chain terms; fund; obtain fresh job-specific Agent/reviewer packets; retain recovery and reconciliation throughout.

## What is delivered

| Component | Function |
| --- | --- |
| `scripts/economics/admission.cjs` | Schema 3 employer qualification, signed exact funding intent, baseline/outcome evidence references, separate capital/cost/job/capacity budgets |
| `scripts/economics/funding-state.mjs` | Two-provider canonical observation of posting terms, duration-adjusted bonds, pauses, native-USDC balance, allowance and unpaid claims before a job exists |
| `scripts/economics/closure-state.mjs` | Canonical successful terminal-event receipt verification, including deleted cancelled jobs and job zero, with at least 64 confirmations and explicit unpaid claims |
| `scripts/economics/canonical-rpc.mjs` | Shared fail-closed chain/hash/freshness checks with no block-number fallback |

The public console remains a manual, permissionless posting interface. **It does not enforce this off-chain qualification.** The private Fleet's separately supplied Employer service integrates these primitives at its approval, funding, signing and rebroadcast boundaries. Direct contract calls can bypass any off-chain policy. No contract or payout rule changes in this release.

## Schema 3

Use `npm run economics:funding -- input.json` for an offline check, or call `checkAdmission`. The outer object still has exactly `policy`, `envelope`, `observed`, `portfolio`. The [existing qualification guide](QUALIFIED_ADMISSION.md) defines signatures, money strings and shared fields. Schema 1/2 worker inputs remain compatible.

Schema 3 has these differences:

| Object | Differences |
| --- | --- |
| Policy | `schemaVersion: 3`, `role: "employer"`; omit `maxPreparationAttempts`; add `capacity` with `allocationId` and positive integer caps `agentSlots`, `reviewerSlots`, `providerUnits` |
| Signed payload | Replace `jobId` with a unique 64-character lowercase hexadecimal `offerId`; the future contract job ID is unknown until the creation receipt |
| Commitment | Exactly `action: "createJob"`, `durationSeconds` (canonical positive decimal integer string), and `details` (exact public contract text) |
| Capacity lease | `allocationId`, unique lowercase SHA-256-shaped `leaseId`, `expiresAt`, `agentSlots`, `reviewerSlots`, `providerUnits`; lease expiry must cover the entire packet lifetime and reviewer slots must cover the declared reviewers |
| Value evidence | `valueEvidence` with `baselineSha256`, `outcomesSha256`, `measurementKind: "observed"`, `sampleCount` meeting policy minimums; these are retained raw-byte report references |
| Observation | Replace `jobId` with `offerId`; include the exact commitment, fetched specification hash, canonical current terms and observation time |
| Portfolio | Add `capacity` with current reserved `agentSlots`, `reviewerSlots`, `providerUnits`; preserve the other cumulative-cost/exposure/job counters |

The offer's price is `lifecycle.terms.jobCostUSDC`, its URI/hash are the existing payload fields, and its participant identity must match the employer wallet. The verifier checks all declared participants, not just the employer. The observation adapter accepts `{primary, secondary, chainId, manager, wallet, offer}` where `offer` has `payoutUSDC` and `durationSeconds`. `fundingRequest(manager, offer)` encodes the four exact `createJob` arguments; `offer` additionally supplies `specURI` and `details`. Neither function signs or reserves funds.

## Runner obligations

Before any approval or funding signature, validate the deployment and normal wallet authority, verify the actual specification and all three retained evidence files, and obtain fresh canonical observations. Block new funding when intake/settlement is paused or the employer has unpaid claims. Reserve total conservative exposure, cumulative maximum modeled cost, native gas headroom and leased capacity in one durable transaction. Enforce unique offer and lease IDs across restarts. Do not count expected profits as available funds or reset spending when a job closes.

Require disjoint allocations for separate journals or use an authoritative shared coordinator. A signature is an assertion that capacity is available; these local counters cannot establish global provider availability or prevent an issuer from allocating the same physical resource elsewhere. Document what a provider unit means and include issuer/RPC/provider delays in qualification evidence.

Use exact token approvals and preserve already-signed transaction identities through ambiguous broadcasts. Match the canonical `JobCreated` receipt to the exact specification, payout, duration and details before binding its returned job ID. Never guess it from `nextJobId`. Recheck qualification and transaction scope before rebroadcast. If authorization expires, observe the original transaction and retain its reservation; do not assume it cannot still mine.

Reconciliation must run without a valid new-work packet. Require proven terminal events or confirmed terminal state and zero unpaid beneficiary claims before releasing capital/capacity. `readClosureState` requires the exact known terminal transaction hash. A missing job, failed RPC, expired packet or zero open-job counter is insufficient. Keep unresolved reservations visible. Unsigned expired offers can be retired only when the runner durably proves no transaction was signed for them. Cumulative cost stays charged conservatively even then.

## Evidence and boundaries

Employer value must come from a credible baseline and measured outcomes, including failed work and capital duration. The signed hashes identify those reports; they do not independently establish their truth. Misestimated value can leave an employer losing while the other roles receive money. Measure realized value, reviewer/Agent/provider costs, human handling and calibration drift; pause/requalify the class when its assumptions no longer hold.

Owner terms, market costs or availability can change after a snapshot and before transaction mining. The unchanged contract has no atomic expected-terms or capacity check. Agent commitment and reviewer voting therefore still need fresh, action-bound qualification after funding. This release provides no new million-offer throughput result, live employer-value dataset, hardware benchmark, external audit or production-capacity certification.
