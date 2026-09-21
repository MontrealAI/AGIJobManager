# Settlement status and recovery

Use this guide when jobs have stopped progressing, a participant has not received USDC, or you need to reconcile outstanding obligations. A completed job can still have an unpaid reserved claim. The manager's five reserve counters, not a count of closed jobs, are the starting point.

## Read the current obligations

From the repository or complete release archive's `source` directory, install the pinned dependencies with `npm ci` using the supported Node version in `package.json`. This command needs no wallet, private key, contract compilation or transaction:

```bash
export SETTLEMENT_RPC_URL='https://YOUR_RPC_ENDPOINT'
npm run settlement:status -- --manager 0xYOUR_VERIFIED_MANAGER --chain-id 1
```

Replace both placeholders. Use the verified address of the instance holding your jobs; publication of this software does not create a live manager. On Ethereum chain 1, the tool requires the manager's settlement token to equal native Circle USDC, `0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48`, as listed in [Circle's registry](https://developers.circle.com/stablecoins/usdc-contract-addresses). On other chains, supply `--expected-token 0xYOUR_VERIFIED_TOKEN`; the tool labels amounts `TOKEN` because your supplied address does not establish its issuer. It also checks chain ID, code presence and six decimals. Manager and library bytecode verification remains a separate [deployment check](../MAINNET_READINESS.md). Keep RPC credentials out of shared reports and shell history; inject credential-bearing endpoints through your secret manager.

The default snapshot is 12 blocks behind the primary RPC's head. This is a configurable confirmation depth, **not a finality guarantee**. Use `--confirmations 0` only when deliberately reading the latest block, such as an isolated local rehearsal. Every code and contract read uses the same [EIP-1898](https://eips.ethereum.org/EIPS/eip-1898) `{blockHash, requireCanonical: true}` selector. The tool also checks the selected height's hash before and after reading. An unsupported endpoint or noncanonical block fails the command; there is no silent fallback to number-based reads. Later reorganizations and dishonest providers remain possible.

RPC head timestamps must be at most **300 seconds old** and at most **60 seconds ahead** of the local clock. The age limit applies to the observed head, not the older confirmed snapshot block. Both configured endpoints are checked, including again before output. Set `--max-head-age SECONDS` to adjust the limit (1–86400). `--max-head-age 0` explicitly disables freshness checks for historical/local rehearsals and is identified as disabled in the report. Keep the host clock synchronized. A recent header does not prove a provider is honest or at the network tip.

For corroboration, configure `SETTLEMENT_VERIFY_RPC_URL` with a second operator's HTTPS endpoint. The command compares both snapshots at the same block and refuses disagreement. Distinct URLs do not by themselves establish independence. Without the second endpoint, the report explicitly identifies a single-RPC observation.

To inspect specific jobs and beneficiaries:

```bash
npm run settlement:status -- --manager 0xYOUR_VERIFIED_MANAGER --chain-id 1 \
  --jobs 0,1 --beneficiaries 0xBENEFICIARY_ONE,0xBENEFICIARY_TWO --json
```

This command accepts at most 50 job IDs and 100 beneficiary addresses, deduplicates selections, and does no unbounded event scan. Omit selections for an aggregate-only report. A missing or cancelled job ID makes the read fail; it is not silently classified as paid. For machine-readable output without npm's banner, use `node scripts/ops/settlement-status.mjs` with the same arguments and `--json`. Existing JSON amount fields retain integer-string units and the v1 schema; `asset`, `stateReference` and `freshness` add the checked asset, read semantics and observed head metadata without endpoint credentials.

On a local chain, for example, add `--expected-token 0xYOUR_LOCAL_TOKEN --confirmations 0 --max-head-age 0`. This explicitly selects a fixture token and allows a simulated clock. These overrides do not bypass canonical-hash support or the expected chain/token checks.

## Interpret the report

All JSON amounts are **integer strings in six-decimal token units**; human output uses exact six-decimal amounts. No floating-point accounting is used.

| Field | Meaning |
| --- | --- |
| `lockedEscrow` | Job payments still held for settlement |
| `lockedAgentBonds` | Outstanding agent collateral |
| `lockedValidatorBonds` | Outstanding validator collateral |
| `lockedDisputeBonds` | Outstanding dispute collateral |
| `lockedClaims` | Failed outgoing payments reserved for their original beneficiaries |
| `totalReserved` | Sum of all five reserve counters |
| `balanceMinusReserves` | Manager token balance less all reserves; negative means a deficit needing investigation; positive can include unsolicited donations |
| `claimsOutsideSelection` | Aggregate claims less selected beneficiaries' claims; selections do not enumerate every claimant |
| `noReservedLiabilitiesAtBlock` | All five counters are zero at this block; says nothing about work quality, participant profit or future obligations |
| `jobs[].deadlines` | Current contract-reported deadlines, including settlement-pause adjustments; zero means that clock has not started |

Exit code **0** means the read succeeded with no aggregate attention flags. It can still have active escrow, overdue jobs or other operational problems; it is not a launch-readiness or recovery-completeness certificate. Exit code **2** means a complete report contains a deficit, unpaid claims, or settlement paused with obligations. Exit code **1** means invalid input, unavailable/inconsistent data or a timeout; do not treat it as a zero-obligation report. The CLI prints no provider error bodies or RPC URLs. A 120-second overall deadline and 15-second request timeout bound the command; retry deliberately rather than building an unbounded loop.

## Recover in the correct order

1. Verify the chain, manager, block and five reserve counters. Preserve the original job IDs, transaction receipts and beneficiary addresses. Reports can associate public addresses and jobs; apply your own retention and access policy.
2. Inspect intake and settlement pauses separately. Settlement pause stops lifecycle clocks and claim execution. Read `getJobDeadlines` again after unpausing; never add fixed durations to old timestamps and assume an exit is available.
3. For open jobs, use the existing [buyer protection paths](../BUYER_PROTECTION.md) and [owner runbook](../OWNER_RUNBOOK.md). Confirm state, caller permission and current deadline, then simulate the exact call. An elapsed deadline alone does not prove transaction eligibility.
4. For `lockedClaims > 0`, identify beneficiaries from your reconciled payment-failure events and receipts, then verify `pendingUSDC(beneficiary)`. Anyone can call `claimUSDC(beneficiary)`; the contract pays the original beneficiary, never the caller. A failed retry does not consume the entitlement. Issuer pause/blocking, insufficient gas or settlement pause may prevent payment; software cannot override these conditions.
5. Retry eligible claims fairly with bounded attempts, backoff and gas budgets. A retry cap is an operational stop, not permission to write off the claim. Record blocked/exhausted work and schedule review after conditions change. Re-read state before every submission and reconcile the receipt afterward, including competing successful retries.
6. Reconcile all five counters and the manager balance at a new confirmed block. All jobs closed with positive `lockedClaims` means payment recovery is incomplete. A zero balance alone also proves nothing without the reserves. Preserve unresolved items explicitly.

## Automate within demonstrated limits

Transaction mechanics and objective acceptance checks can be automated. Independent judgment about ambiguous deliverables, collusion, identity control or exceptional disputes needs an accountable resolution path. More computers alone do not prove independent judgment or unlimited capacity. No private agent, node, fleet runtime, credentials or model policy is included in this public release.

Bound admission by the slowest shared service: validation, moderation, gas, RPC, evidence retrieval and payment recovery. Measure queue age, reserve exposure, claim age, blocked beneficiaries, retry exhaustion and actual accepted work. Reserve recovery capacity even while intake is busy. Stop admitting more work when available capacity cannot meet the configured service targets.

Give each automation role only its intended permissions; keep owner authority separate from routine work. Coordinate nonces and spending budgets for shared signing wallets, use current transaction simulation, and treat external job/evidence/model text as untrusted input. Halt controls must be checked immediately before signing or rebroadcasting. These are operator responsibilities; this read-only report does not implement a transaction scheduler or autonomous moderator.

“Zero remaining liabilities by day 180” in a simulation means only that modeled obligations resolved under that scenario's admission, capacity, uptime and retry assumptions. It does not establish that every employer avoided losses, every offered job was admitted, all work was useful, or production funds can never be delayed. Separate financial reconciliation, useful work, throughput and human handling measurements. Estimated handling hours are not measured automation savings.

## Reproduce the public regression checks

```bash
npm ci
npm --prefix hardhat ci
npm test
```

The contract test suite includes `test/settlementStatus.test.js`: completed jobs with unpaid recipients, beneficiary selection coverage, successful permissionless recovery, paused deadlines, donations, inconsistent balances, wrong chains, missing/cancelled jobs, simulated block-hash changes, RPC disagreement and bounded inputs. Additional regressions cover canonical-hash selectors, refusal of unsupported hash reads, token mismatch, malformed metadata, stale/future heads, neutral custom-token labels and actual two-endpoint CLI success/failure. These are isolated local fixtures and transport-failure simulations, not production throughput or mainnet uptime measurements. The [v1.2.1 review](../qualification/V121_REVIEW.md) records the reproduced gaps and remaining limits.
