# Review protection and calibrated admission

AGIJobManager 1.7.0 adds an optional, separately deployed `AGIReviewEscrow`. Existing manager contracts, job escrow and payout percentages are unchanged. This release is a commissioning candidate. Passing software checks does not establish production profitability, independent audit, or physical fleet capacity.

## What an AGI Job is

An employer posts a specification, a USDC price and a deadline. An eligible Agent takes responsibility for producing the requested artifact. Independent Nodes assess the delivered artifact against the specification; the employer can accept, or a dispute and recovery path can resolve the engagement. The main contract holds money and enforces settlement rules. It cannot establish an artifact's commercial value or judge arbitrary real-world quality.

Examples include a structured extraction from supplied records, a normalized product catalog or a JSON report checked against explicit criteria. These are examples of work descriptions, not blanket claims that every such task is automated correctly. Private unattended decisions require the supported formal job format, immutable public inputs and explicit machine-checkable acceptance criteria. Confidential customer data and arbitrary legal, medical or subjective decisions need a separately designed workflow.

The historical studies evaluated one million **offers**, not one million completed jobs. Their useful-output and employer-value labels were modeled. This release does not rerun those studies or transfer their network throughput to 512 Macs.

## The payment problem and the new agreement

A reviewer can start work and incur costs before recording a vote. Buyer acceptance can then close the job. The existing vote reward does not compensate every such path.

The new agreement buys bounded review capacity from a **named reviewer**:

1. The employer's signed pre-funding qualification includes each additional retainer and checks employer value after that expense.
2. After a delivery exists, the employer deposits the exact fee for that job, reviewer and completion-URI hash.
3. The reviewer activates the assignment while the exact delivery remains reviewable. The fee becomes an irrevocable credit immediately.
4. The reviewer collects that credit to its own address. Private workers require canonical confirmation of earned state and zero remaining credit before paid processing.
5. The existing independent review and vote rules remain in force. Acceptance or closure after activation cannot revoke the earned retainer.

This is **payment for authorized capacity**, not proof of completed review, an approving vote or correct judgment. An authorized reviewer can activate and then fail to perform. The employer bears that risk. Use independent identity checks, explicit appointments, small fees, capped attempts, measured costs and revocation of future appointments after failures. Do not describe this as a guarantee that every role profits.

For a 1,000-USDC job with three 8-USDC retainers, the employer commits up to **1,024 USDC before its other costs**. The extra 24 USDC does not come from the Agent or existing vote-reward pool. If three Nodes each spend 6 USDC after collecting 8, their retainer-only net is +2 each before any omitted cost. These are illustrative inputs, not measured prices. An acceptance before activation yields no retainer to that reviewer and the worker must not start spending.

## Contract states and recovery

| State | Money | Permitted next step |
| --- | --- | --- |
| Absent | Nothing reserved in companion | Actual employer funds an exact delivery assignment |
| Funded | Escrow liability; not reviewer income | Named reviewer activates before startBy; employer may cancel; anyone may release after expiry |
| Earned | Irrevocable reviewer credit | Anyone triggers withdrawal to that reviewer only |
| Refunded | Employer credit | Anyone triggers withdrawal to the employer only |

One assignment is allowed per chain, companion, manager, job and reviewer, including cancelled assignments. There is no administrator, upgrade function, arbitrary withdrawal or sweep. Direct token donations are not credited and cannot be recovered through this contract. Do not transfer USDC directly to it; call `fundReview` with an exact allowance.

USDC pause, blacklisting, chain outages and reorganizations can delay collection. A failed transfer preserves credit and liability. The worker must wait, reconcile and recover; an on-chain credit is not received cash. The separate companion's liabilities must appear in monitoring alongside the manager's claims. Confirmation depth reduces reorganization risk but does not mathematically eliminate it.

## Deploy the companion with Hardhat

Use the matching source and lockfiles, public Node 22.23.2 toolchain, and the normal [Hardhat deployment procedure](../../hardhat/README.md). Do not replace the manager to add this companion.

Set `JOB_MANAGER` to the verified manager and `JOB_MANAGER_CODE_HASH` to the independently checked Keccak-256 of its deployed runtime. Set the target network's usual primary RPC and deployment signer. Run a plan first:

```sh
DRY_RUN=1 npm --prefix hardhat run deploy:review-escrow:sepolia
```

`deploy:review-escrow:mainnet` is the corresponding mainnet command. Planning estimates deployment gas but broadcasts nothing. Real deployment additionally requires `DRY_RUN=0`, `VERIFY_RPC_URL` for an independent witness, `ETHERSCAN_API_KEY`, sufficient funds and a reviewed `MAX_REVIEW_DEPLOY_ETH` ceiling (default 0.05 ETH). Mainnet also requires `DEPLOY_CONFIRM_MAINNET=I_UNDERSTAND_MAINNET_DEPLOYMENT`. `CONFIRMATIONS` must be 3–128, default 3; worker spending uses at least 64 confirmations separately.

The script checks native USDC, the manager runtime pin, deployment size and gas cost; records the predicted address and nonce before deployment; preserves compiler input and transaction receipts; verifies both immutable addresses against the compiled runtime; checks an independent RPC; and requires explicit explorer success. These checks do not constitute an independent security audit.

The per-manager deployment journal refuses blind repeat deployment. If a command fails, preserve it and reconcile the nonce, predicted address and transaction before retrying. For a journal with a recorded, successful transaction, set `REVIEW_ESCROW_ADDRESS` to its recorded address and rerun with `DRY_RUN=0` to finish verification. If the broadcast result was lost before a hash was saved, investigate the recorded nonce/address and recover the authentic receipt before using that recovery path. Never delete the journal to silence the guard.

The output's **address and runtime code hash** are the private enrollment pins. Rehearse activation, cancellation, early acceptance, token-transfer failure and collection with independent participants before authorizing intake. No companion is deployed by downloading this release.

## Calibrate economic assumptions

Lifecycle schema 2 adds `reviewRetainers` and a `retainerStates` map for every modeled outcome. Valid states are `unfunded`, `reserved`, `paid`, `unavailable` and `refunded`. Fees increase employer capital at risk; only `paid` is reviewer cash. The payment-unavailable case retains liability rather than inventing a receipt.

Worker admission schema 4 extends action-bound schema 2; employer schema 5 extends pre-funding schema 3. Both require the exact signed evidence-report bytes and lifecycle schema 2. Older schemas remain available for historical offline verification. New private native-USDC intake requires 4/5. Existing obligations and recovery are not erased on upgrade.

Build a report from a reviewed lifecycle model and observations:

```sh
node scripts/economics/calibration.cjs lifecycle.json observations.json > calibration-report.json
```

Observations must specify schemaVersion 1, measurementKind (`observed` or `simulated`), jobClass, environmentSha256, measuredAt and records. Each record has an immutable unique id, group, partition (`calibration` or `evaluation`), caseId, participant costsUSDC/depositsUSDC/receiptsUSDC maps, otherReceiptsUSDC, liabilitiesUSDC, employerValueUSDC and evidenceSha256. Cash must conserve. Employer artifact value is kept separate from cash.

Hold evaluation groups out when fitting assumptions. Groups cannot cross partitions. Record failures, nonperformance, attempted but unrewarded work, provider retries, human exceptions, capital costs and receipt delays. Use actual receipt dates and conservative value baselines. A group label does not prove statistical independence: correlated incident runs, shared provider outages and repeated customers still need appropriate sampling.

The policy binds environment and evidence kind, minimum held-out sample count, probability-drift tolerance, a positive floor on every modeled stress case, realized margin floors and loss-rate ceilings. Forecast costs cannot be lower than observed maxima, and forecast employer value cannot exceed observed minima within an observed case. Frequencies must match both partitions within policy tolerance. Retain the raw observations and their evidence; the signed report binds their digest. The validator checks the report, not the truth of off-chain claims. Independent issuer review remains essential.

These are empirical guards, **not statistical confidence guarantees**. Unobserved cases remain conservative stress assumptions; passing them does not prove their probabilities. Private mainnet policy must allow only `observed` evidence. A synthetic dataset cannot become a measurement by changing its label. Synthetic unit fixtures exercise validation branches only and have no production authority.

Requalify after material provider, job mix, pricing, queue, gas, deployment or employer-value changes. Measure realized value on a declared baseline rather than assuming that cheap AI production makes an artifact valuable.

## Bound qualification work and measure it

`QualificationService` bounds running and queued requests, rejects duplicate in-flight keys and deadlines, prioritizes recovery and reserves recovery capacity. It never caches an authorization. Timed-out work keeps its concurrency slot until it actually stops. A stuck dependency therefore reduces service capacity and raises an operational incident instead of permitting unlimited background work.

The defaults are four concurrent tasks, 32 queued tasks and one reserved recovery execution slot; intake uses at most three execution slots and 31 waiting slots. Queue wait is capped at 10 seconds and task runtime at 30 seconds. An async scheduler does not parallelize CPU-bound signature work. Deploy sharded issuer services with distinct allocations and measure the complete RPC, evidence, signing, delivery and renewal path. This release does not implement a distributed atomic allocator or certify a production issuer cluster.

```sh
npm run economics:benchmark -- 200 qualification-benchmark.json
```

The benchmark performs full signed-envelope and calibrated-report checks on synthetic data in paced and burst modes. It excludes RPC, real issuer signing, model providers and Mac performance. A rejected request is not a completed qualification. Monitor accepted rate, rejection reasons, p95/p99 latency, freshness at use, recovery latency and sustained queue growth. Capacity must exceed measured peak demand with reviewed headroom while preserving fresh checks at commitment.

## Production qualification remains a separate decision

Require independent contract review; a funded native-USDC rehearsal; measured actual Mac/provider quality, cost and uptime; independent reviewer/issuer controllers; verified employer-value evidence; complete receipt and labor accounting; and repeated recovery under outages and reorgs. Set rollout and stop thresholds before the pilot. Sustained useful settlements, per-role downside and receipt latency matter more than offer count. Expand only after the pilot meets those predeclared thresholds.
