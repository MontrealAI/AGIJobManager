# Qualified admission inputs

Current new-work entrypoints require **schema 6 operator-budget** policies for Agents/Nodes and **schema 7** for employers. They retain signed action binding, calibrated evidence and canonical observations. These are public verification primitives; the private fleet integrates them with durable reservations and signing. The permissionless contract does not enforce the off-chain screen.

Use `checkNewWork` at an operating boundary. `checkAdmission` and policy schemas 1–5 remain for historical offline analysis. They do not authorize new paid work.

## Start with the lifecycle model

```sh
npm ci
npm run economics:lifecycle -- --example
npm run economics:lifecycle -- your-lifecycle.json --json
npm run economics:admission -- --help
```

`lifecycle-example.json` is hypothetical teaching data. A passing result means the supplied numbers meet supplied limits. Exit codes are 0 for within limits, 2 for outside limits, and 1 for invalid input. The older `economics:check` and `economics:screen` commands remain compatible.

The lifecycle schema declares individual participants and mutually exclusive cases, each with its own reviewer attendance, votes, dispute collateral, artifact value and participant costs. It requires agent-win, buyer-win, buyer-acceptance, neutral timeout, non-delivery, pre-assignment cancellation and unavailable-payment cases. Include zero-review settlement, reviewer absence and adverse voting, and a 50-approval dilution case. Zero-weight stresses still count toward maximum loss. An unavailable-payment case must stress all declared participants with zero artifact value.

Cancellation does not confiscate an agent bond that was never posted. Non-delivery forfeits the assigned agent's bond to the employer. Neutral refunds compensate neither delivery costs nor time. Payment unavailability means cash remains unavailable at the specified horizon; protected claims are not extinguished. Costs should include gas, failed attempts, inference, acquisition, human exceptions, overhead, capital duration and operational recovery where applicable. Values must be measured or conservatively justified; protocol transfers alone create no employer value.

All USDC amounts use exact decimal strings, with at most six fractional digits. Integer settlement arithmetic reuses the contract accounting model. Expected values preserve twelve fractional digits. Conservative exposure is the maximum own committed capital plus maximum own modeled cost, separately from expected profit. Other undeclared voters model dilution only; their economics are not certified. The required cases are not an exhaustive failure model.

## Verify a qualification envelope

`require('./scripts/economics/admission.cjs')` exports `canonical`, `digest`, `validatePolicy`, `checkNewWork` and historical `checkAdmission`. The CLI accepts one JSON object with exactly `policy`, `envelope`, `observed`, `portfolio` and `evidenceReport`; the system clock supplies `now`. It returns JSON on success and exits 1 on rejection. API callers may inject `now` for tests.

An operator policy contains these fields:

| Field | Required meaning |
| --- | --- |
| `schemaVersion`, `epoch` | Version 6 for current worker integration; version 7 for employer funding, and a distinct accounting/authority epoch |
| `chainId`, `manager`, `wallet`, `role` | Exact scope; lowercase nonzero addresses; role `agent` or `reviewer` |
| `trustedKeys` | 1–8 issuer IDs mapped to Ed25519 public keys in PEM format |
| `classes` | Explicit qualified job-class allowlist |
| `reviewPayment` | Exactly `operator-budget` for current new work |
| `calibration` | Required calibration policy; see the field reference below |
| `maxPreparationAttempts` | Worker-only durable attempt ceiling, integer 1–100 |
| `maxPacketAgeSeconds` | 1–3,600 seconds; bounds issue age and signed lifetime |
| `maxEvidenceAgeSeconds` | 1–2,592,000 seconds |
| `minimumSamples`, `minimumHorizonDays` | Nonzero evidence sample and assessment horizon requirements |
| `limits` | Employer, agent and reviewer objects, each with `minimumExpectedNetUSDC` and `maximumScenarioLossUSDC` |
| `maxOpenExposureUSDC`, `maxEpochCostUSDC`, `maxOpenJobs` | Independent aggregate capital/cost, cumulative modeled-cost and open-job limits; at most 100 open jobs |
| `maxGasWeiPerJob` | Positive integer string bounding the packet's total native gas budget |

The envelope has exactly `keyId`, `payload`, `signature`. Sign the UTF-8 result of `canonical(payload)` with Ed25519 and base64-encode the 64-byte signature. `digest(policy)` is the lowercase SHA-256 of the canonical policy. Do not use an Ethereum transaction key as the qualification issuer key. Keep issuer keys outside the public repository, content storage and worker packets.

The payload has exactly:

- `schemaVersion: 6`, `policyDigest`, canonical unsigned uint256 decimal-string `jobId` (including the first job, `"0"`), `participantId`, `jobClass`, integer Unix-second `issuedAt` and `expiresAt`.
- `specURI`, and `specSha256` of the exact specification bytes consumed by the worker.
- `evidence`: `reportSha256`, integer `measuredAt`, integer `sampleCount`, `qualification: "qualified"`, and `costsIncludeFailuresAndOverhead: true`. These are signed attestations that must be backed by a retained report. The public verifier does not fetch that report or certify its contents.
- `identities`: every lifecycle participant ID mapped to `{wallet, controllerId}`; `controllerId` is a stable SHA-256 identifier for an independently verified controller. All wallets and controllers must differ. Different strings or machines alone do not establish independence.
- `lifecycle`: the full lifecycle input. The verifier replaces participant margin/loss limits with the operator's role limits before calculating.
- `gasBudgetWei`, a positive integer string, and `ethPriceCeilingUSDC`, a positive conservative ETH valuation supplied by the issuer. Every case must include at least this gas budget's rounded-up USDC cost for the scoped participant. The tool does not discover a live ETH price.

The observed object has `chainId`, `manager`, `wallet`, `jobId`, `specURI`, `specSha256`, `terms` and `observedAt`. Terms must exactly match the signed lifecycle terms; observations may be at most 120 seconds old. The portfolio has `openExposureUSDC`, `epochCostUSDC` and `openJobs`, excluding the candidate job. A runner must obtain and reserve these values transactionally, not accept them from an untrusted client.

A success is `QUALIFIED_UNDER_ATTESTED_INPUTS`, with a packet digest and amounts to reserve. Its `authorization` remains `NONE`: copying or replaying this output cannot authorize a transaction. A valid signature proves which approved issuer attested to the payload, not the truth of demand, value, probabilities, independence or cost forecasts.

## Bind the exact current action

Policy and payload versions must match. Current worker policies require `maxPreparationAttempts` (integer 1–100) to the policy and `commitment` to both the signed payload and observed object. Unknown or missing fields fail validation.

| Role | Exact commitment |
| --- | --- |
| Agent | `{"action":"apply","decision":null,"completionURI":null,"deliverySha256":null}` |
| Reviewer | `{"action":"vote","decision":"approve","completionURI":"ipfs://…","deliverySha256":"<64 lowercase hex characters>"}`; `reject` is the other supported decision |

For the scoped reviewer, every non-absent ballot must equal the committed decision, including zero-weight stresses. A reviewer cannot model an approving reward while committing a rejection, or choose whichever ballot wins in each outcome. Different decisions require freshly qualified economics. The runner must compare the actual vote and hash of reviewed delivery bytes; it must not fill observed fields from the packet itself. Agent packets cannot pre-authorize votes.

The read-only adapter includes `completionURI` from the same canonical block on both providers. It does not fetch or hash the delivery. Successful current output includes a detached copy of the commitment and preparation limit. The verifier is stateless: runners must durably count attempted preparation/provider stages before starting them, including failed or interrupted stages, across restarts and packet renewals. Modeled costs must cover the allowed attempts. This is a count ceiling, not a measured provider bill.

Historical versions remain readable by the offline analysis API. Current `checkNewWork` rejects those versions and retainer mode. Upgrade through a new issuer-signed policy epoch, preserve existing reservations and reconcile old obligations; changing the label on a signed packet is invalid.

## Integrate at a signing boundary

1. Obtain real qualification evidence and a scoped operator policy. No sample defaults qualify a production job. Retain the evidence report and verify its digest.
2. Read current contract terms with `readAdmissionState` from `scripts/economics/admission-state.mjs`. Supply distinct primary/secondary RPC clients with `.send`, explicit chain/manager/wallet/job, and optionally a bounded confirmation depth. Native Ethereum or Sepolia USDC and six decimals are required. Every state read uses EIP-1898 `blockHash` plus `requireCanonical`; unsupported endpoints, stale heads, reorgs and disagreement fail closed. Manager/library bytecode qualification is a separate runner responsibility.
3. Match the employer and assigned agent to the attested identities, verify the fetched specification and delivery bytes and exact commitment, eligibility, full deployment pins, fees, gas, nonce and action scope. Separate endpoints need genuinely separate operators to improve independence. Configuration changes or reorgs after the read remain possible.
4. Before spending on preparation, atomically reserve the conservative exposure and full modeled cost. Recheck before every new bond commitment and before rebroadcast. Persist reservations across crashes. Do not undercount legacy positions, pending transactions or unpaid beneficiary claims. Use one active host per wallet or a genuinely shared reservation authority; local files do not synchronize multiple machines.
5. Bound transaction gas and known compute usage. A forecast is not a meter; measure actual spend and pause/requalify a class when observed outcomes, costs or human handling depart from its evidence. New-work rejection must not disable delivery, claims or recovery of existing obligations.
6. Run bounded reconciliation independently of new admission and issuer availability. After settlement, release capital only using sufficiently confirmed canonical observations and paid claims. Do not infer payment from a terminal job flag. Preserve epoch spending rather than resetting it when a job closes.

The public tools neither run these steps autonomously nor guarantee profit, throughput, full autonomy, permanent fund recovery or avoidance of loss. The current operating policy does not change Solidity, deployed bytecode, ABI, linked libraries or payout rules.

## Employer funding (schema 7)

Use [pre-funding qualification](PREFUNDING.md) for the employer/offer scope before a job exists. The employer policy uses schema 7, `reviewPayment: operator-budget`, calibrated evidence and lifecycle schema 1. No retainer fee or revenue is included.

## Required calibration and report bytes

Policy `calibration` has exactly `allowedKinds`, `environmentSha256`, `minimumEvaluationSamples`, `maximumProbabilityErrorPpm`, `minimumCaseWeightPpm` and `maximumObservedLossRatePpm`. The allowed measurement kinds are explicit; private mainnet enrollment requires observed evidence. Bounds and report checks are defined by [calibration.cjs](../../scripts/economics/calibration.cjs). These limits must be independently selected from representative evidence.

`evidenceReport` is the exact UTF-8 JSON report **string**, not the parsed report object. Its raw-byte SHA-256 must match the signed `evidence.reportSha256`. Calibration binds job class, environment, disjoint calibration/evaluation groups, measured sample counts and probability/loss constraints. The full current policy also requires `reviewPayment: operator-budget`; lifecycle schema 1 forecasts zero retainer income.

## Run a complete synthetic example

From the source root:

```bash
node scripts/economics/admission-example.cjs agent > /tmp/agi-admission-example.json
npm run economics:admission -- /tmp/agi-admission-example.json
```

Use `reviewer` for the other worker role. The example creates a fresh short-lived envelope, uses the publicly known fixture key and chain 31337, and includes every required input field. It demonstrates the parser and calculation only. Its identities, outcomes and budgets are synthetic and have no production authority. Do not enroll its key in a real operator policy. A successful result still returns `authorization: NONE` and is not a reservation or transaction.
