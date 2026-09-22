# General computer work

**Current operating policy:** new work uses [operator-budget admission without retainers](NO_RETAINERS.md). Retainer sections below describe historical analysis and existing-obligation recovery, not new funding.

AGI Jobs covers lawful work that a person or team can perform with a keyboard and mouse while watching a screen. An Agent performs computer work; a Node independently performs the computer work needed to verify it. Templates describe examples, not an eligibility catalogue.

## The executable job specification

`computer-work/v2` describes a goal, immutable inputs, required outputs, independently testable criteria, environment, permissions, time and cost limits, deadline, settlement/recovery context and optional parent/dependency references. Validate the [example](../../examples/computer-work-v2.json) with:

```bash
npm run computer:check -- examples/computer-work-v2.json
```

The example runtime contains placeholder image/policy hashes. Replace them with descriptors from the actual commissioned Agent and Node. Runtime hashes bind model, OpenClaw version, image, tool capabilities and authority. A changed configuration requires a new specification and fresh qualification. Model names do not establish measured competence.

There is no profession or filename-extension allowlist in v2. Each native artifact declares its media type and byte limit. Safe relative paths, exact file counts, hashes, total size, canonical base64 and criterion/evidence coverage remain mandatory. Limits are 64 files, 32 MiB per file and 64 MiB of raw files per input/output set. The encoded bundle is bounded at 90 MiB. Transport integrity is not semantic correctness; independent review remains necessary.

The private runtime uses code, browser and desktop tools in disposable environments. It checks the configured runtime before spending, requires the full declared work time plus a completion reserve to fit before starting, then applies a bounded attempt timeout, and preserves failed-attempt accounting. A Node receives immutable source inputs and actual delivered files in a fresh workspace. It must address every acceptance criterion, cite actual files and abstain on uncertainty. A textual checklist can still be wrong; commissioning must check it against independent outcomes.

The existing public wallet workflow handles public data in an isolated workstation and rejects scoped data. Private companions now also include a separate native runner for dedicated signed-in Mac accounts. Runtime schema 2 binds `openclaw-native/v1`, the signed app installation, source/configuration, role model, resources and native capabilities. It does not mislabel a native installation as a Docker image. Signed task grants, encrypted recipient handoffs and exact delivered-byte review are required. Native OS-account authority is broad; task labels do not sandbox applications or network access. Keep wallets and grant signing keys in a different account.

The private native workflow does not automatically post encrypted jobs, submit completion URIs or sign public-chain Node votes. A future private settlement bridge must preserve data access, independent review and existing economic/signing gates. The current public publisher rejects scoped content before any public request. Use [private setup](PRIVATE_FLEET.md) and [operational qualification](WORKFORCE_QUALIFICATION.md) for actual coverage.

Large/team projects can reference parent jobs and dependencies. Each delegated job needs its own authority, economic admission and settlement. These references do not automatically spawn work or implement atomic parent/child settlement. The present private task runner caps one processing attempt at ten minutes; long projects require independently admitted stages. This is an implementation limit, not a boundary on the protocol's work domain.

## New work uses operator budgets

Current operating entrypoints require schema 6 participant policies or schema 7 employer policies with `reviewPayment: operator-budget`. No retainer income, fee, activation or confirmation delay is admitted for new work. The Node explicitly accepts bounded unpaid-review risk and reserves its complete permitted processing allowance before spending. The employer funds the job without a review-escrow policy dependency.

Use `checkNewWork` and the [current qualification reference](QUALIFIED_ADMISSION.md) at an operating boundary. `checkAdmission` still reads historical schema formats for offline analysis. It is not the new-work boundary. Existing paid obligations, credits, refund rights, policies and journals remain available for reconciliation and recovery; they are not rewritten into a new payment mode.

Signed calibration, observed evidence on private mainnet, independent controllers, collateral, gas and capacity limits remain required. Include failed and unpaid work in costs. The public manual console and permissionless contract do not enforce the private admission policy.

## Measure improvements before promotion

`npm run computer:report -- plan.json ledger.json` produces a capability/economics report for a frozen plan and exactly one ledger result per planned engagement. Every failure, timeout, refusal and abstention remains in the denominator. Include invalid artifacts to measure false acceptance. Declare disjoint calibration/evaluation groups, exact specification/runtime hashes, independent outcome evidence and actual provider bills. Missing costs leave profitability unknown.

Observed records require trace and evidence hashes and independent-oracle provenance. The tool checks completeness and consistency, not whether those external observations are truthful. Wilson intervals assume independent Bernoulli observations; correlated errors and selected benchmarks need separate analysis. Reports grant no execution, wallet or production authority.

Use a bounded improvement cycle: freeze workloads and limits, compare policies on calibration work, select only candidates satisfying all constraints, evaluate the unchanged selection on held-out work, then commission on real hardware. Keep the prior policy when no candidate qualifies. A new model, browser adapter, prompt or image is a new runtime to test. Do not tune against the evaluation cohort and relabel it held out.

## Current capability evidence

Reviewed 22 September 2026: [OpenAI computer-use guidance](https://developers.openai.com/api/docs/guides/tools-computer-use) supports combining code-driven interaction, browser control and desktop actions; [OpenClaw computer-use documentation](https://docs.openclaw.ai/nodes/computer-use) describes desktop/browser providers, frame-bound input and provider-specific capabilities. These support the general operator/verifier design. They are vendor documentation, not measurements of this fleet, its Mac hardware, reliability, costs or employer value.

The current private profile uses GPT-6 Astra and pins OpenClaw 2026.9.5. Pin and qualify a runtime instead of silently installing a new model or tool release. Public deployment and recovery commands remain in the [release guide](../RELEASE_GUIDE.md).
