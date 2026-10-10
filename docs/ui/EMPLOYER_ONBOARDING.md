# Employer onboarding — from a clear brief to a funded job

Start with the dedicated [English employer page](https://montrealai.github.io/AGIJobManager/employers/) or [French employer page](https://montrealai.github.io/AGIJobManager/fr/employers/). It helps you describe a result, choose a USDC budget and assignment duration, and prepare a brief before opening the transaction console.

The onboarding page is a static planning interface. Drafting needs no wallet, ENS name or account. It does not select a live manager, verify live availability, reserve an Agent or reviewer, upload your brief, or send a transaction. The [deployment registry](../../config/usdc-deployment.json) currently supplies no default live manager. Obtain and independently verify your operator's deployment before funding.

## Prepare your first job

1. **Choose a result.** Choose the closest template, then tailor it to your own deliverable. Example jobs and budgets are planning aids, not offers, completed jobs or guaranteed capability.
2. **Make success checkable.** Specify the files or behavior to deliver, public input sources, acceptance tests and evidence a separate reviewer should inspect. State permitted tools, dependencies and licensing where relevant.
3. **Set the full job cost in USDC.** Use up to six decimal places. This is the total escrowed job cost, including the settlement allocations below. ETH for gas and any external service expenses are separate.
4. **Set the duration after assignment.** The contract counts seconds from the first successful eligible Agent application, not from when you write or post the brief. Review, challenges and disputes can extend the time until settlement.
5. **Review the public content and download the brief.** Use **Download job brief (JSON)** to keep a portable planning copy. Do not include personal information, confidential inputs, credentials or private sharing links. Downloading does not upload or publish the brief.
6. **Continue to the console when ready.** Use **Continue to posting console** for the existing USDC interface. Follow the draft-transfer instructions below and verify the transaction's actual fields before signing.

Write a small first job with observable acceptance criteria. For example: “Add CSV export to this public demo; deliver the source change, a runnable demo, and tests covering empty data, commas and Unicode.” Avoid a broad instruction such as “improve the product” without a definition of completion.

## Drafts, language switching and the console handoff

Typing does not automatically persist an onboarding draft. Explicit save, restore and clear controls manage an unencrypted copy in this browser. Language switching may carry the current draft through temporary browser session storage so you can continue in English or French. It does not translate the text you wrote. Shared devices and other scripts on the same origin can access browser storage; use public content only.

The console handoff can write the compatible builder draft on this device only after the page's explicit transfer action and any required replacement confirmation. In the console, open the job builder and choose **Load saved draft**. The console does not load it automatically. Read every restored field, including the USDC payout and duration in seconds.

The download is a planning brief. It is not a funded job, admission authorization, transaction receipt or final published metadata URI. In the console, complete the required metadata fields, generate and review the job specification, then publish it using your chosen public hosting or pinning workflow. Put the resulting durable specification URI in the posting form. A local file on your computer is not a publicly retrievable specification.

If storage is unavailable, use the JSON download and copy the reviewed fields into the console. Export an existing console draft before replacing it. Clearing an onboarding draft cannot erase downloads, published content or on-chain records; use the console's **Clear saved job content** for its own saved content.

## What to verify before funding

| Check | Why it matters |
| --- | --- |
| Ethereum mainnet, chain ID `1`, and the independently verified manager address | A valid-looking address or successful getter does not authenticate a contract |
| `usdcToken()` equals native Circle USDC `0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48`, with six decimals | Approve the intended token and manager only |
| The current `wallet30()`, `wallet10()` and `validationRewardPercentage()` | Confirm where successful-job funds will go; the validator rate is snapshotted when the job is posted |
| Both `paused()` and `settlementPaused()` are false | Job creation needs both intake and settlement enabled; fresh managers start with intake paused |
| Current `maxJobPayout` and `jobDurationLimit` | These are owner-configurable live limits; a local estimate does not establish admission |
| Eligible execution and independent review capacity | Posting does not guarantee an Agent will take the job or reviewers will be available |
| Operator terms, review deadlines, recovery route and your own authority to commission the work | Know the actual counterparty and how the job will be operated |

Posting employers do **not** need an Agent ENS name, membership NFT or validator credential under the current `createJob` function. Agent and validator eligibility checks apply to their respective roles. An external operator can have its own admission conditions.

The current contract permits the first eligible successful application to take an unassigned job. It has no employer shortlist or later hiring approval step. Do not post to the permissionless manager if your intended workflow requires selecting a particular worker before assignment.

Approve the exact required USDC amount, then review and submit `createJob(jobSpecURI, payout, duration, details)`. Approval is a separate transaction and does not post a job. The contract limits the specification URI and on-chain details to 2,048 UTF-8 bytes each; keep the on-chain summary short and put the complete public brief behind the specification URI. Save the successful posting receipt and `jobId` from `JobCreated`.

## Understand the payment

For a successful **100 USDC** job with the default 8% validator rate and qualifying review, the base allocations are:

| Recipient | Amount included in the original job cost |
| --- | ---: |
| Correct-side validators, collectively | 8 USDC |
| First configured settlement wallet | 30 USDC |
| Second configured settlement wallet | 10 USDC |
| Assigned Agent | 52 USDC |

The two wallet shares are fixed percentages of the original cost. The owner can set the validator percentage from 1 through 60 for future jobs; each posted job keeps its rate. Bonds, slashing, rounding and unallocated rewards affect outcome accounting separately. The onboarding calculator is an illustration, not a live quote.

Explicit buyer acceptance or authorized arbitration can settle an unreviewed successful job. If there are no validators, the split is 30% / 10% / 60%, with no validator payment. Ordinary finalization with no votes, insufficient quorum or a tie opens a dispute and pays nobody. See the [complete payout specification](../USDC_PAYOUT_SPLIT.md).

## After the job is posted

- **Before assignment:** the employer can cancel and recover the escrow.
- **After assignment:** monitor the assignment deadline from `getJobDeadlines(jobId)`. If it passes with no completion request or dispute, expiry can be called under the contract's conditions.
- **After submission:** inspect the deliverable promptly. Explicit acceptance authorizes payment and ends further review. Otherwise follow the review, challenge and dispute windows for that actual job. A submitted link does not prove the work meets the criteria.
- **If review is inconclusive or the work is disputed:** use the supported on-chain dispute process and applicable bond. If arbitration remains unresolved, the neutral refund path becomes available after its required windows.
- **After settlement or refund:** verify the receipt, resulting job state, payments and `pendingUSDC`. Failed outgoing transfers remain reserved for their original beneficiaries and can be retried when transfers are possible.

Settlement pauses stop lifecycle clocks and extend deadlines. Time passing alone never sends USDC: settlement, expiry, refund and payment retry require transactions. Read the [employer lifecycle guide](../roles/EMPLOYER.md), [buyer protection](../BUYER_PROTECTION.md) and [recovery guide](../OPERATIONS/SETTLEMENT_RECOVERY.md).

## Planning for a very large employer population

Billions of potential employers is a design ambition, not a measured capacity claim. A statically hosted onboarding page lets people learn and prepare locally without one application server session per visitor. It does not establish that GitHub Pages, the RPC providers, workforce or one Ethereum deployment can process billions of users or jobs. Hosting quotas and an appropriate production CDN must be assessed before a large campaign.

Treat expansion as separately measured layers:

| Layer | Current boundary | Evidence and work needed before expansion |
| --- | --- | --- |
| Discovery and local drafting | Static English/French pages with browser-local planning | Traffic targets, accessibility and usability studies, CDN capacity, cache behavior, and recovery under traffic spikes |
| Job discovery and status | The existing console reads contract state and events | A paginated event indexer with chain/manager keys, reorg handling, replayable checkpoints and explicit freshness; avoid unbounded per-browser scans |
| Automated employer intake | Separate qualified employer tooling; the manual console does not enforce it | Authenticated, action-bound authority, budget and capacity reservations, duplicate prevention, expiry and retry rules |
| Execution and review | Eligible Agents and validators perform off-chain work | Observed completion quality, independent reviewer supply, deadline performance, cost and loss limits, and measured human intervention |
| Network and admission load | Each provider and deployment has finite capacity | Quotas, rate limits, bounded queues, backpressure, overload handling, provider failure exercises and fair admission policy |
| Identity and operator controls | Wallet/ENS credentials and deployment-specific policies | Key recovery and rotation, verified authorization, conflict handling and independently reviewed operation; credentials alone do not prove identity or independence |
| Settlement | Transactions execute on the selected manager's chain | Measured gas, inclusion and finality latency, sustainable job throughput and cost, pause/refund recovery, reserve reconciliation and failure exercises |

For automated funding, use the existing [pre-funding guide](../OPERATIONS/PREFUNDING.md), [qualified admission](../OPERATIONS/QUALIFIED_ADMISSION.md), [operating qualification](../OPERATIONS/OPERATING_QUALIFICATION.md) and [workforce qualification](../OPERATIONS/WORKFORCE_QUALIFICATION.md). An exported brief or browser checkbox is not a signed admission result.

Moving settlement to another chain, an L2, batches or multiple managers would be a separate protocol and deployment design with token, identity, bridge, custody and recovery implications. This onboarding change implements none of those. Preserve each existing job and its claims on its original manager. Grow from measured pilots with explicit service objectives before making a population-scale or settlement-throughput claim.

## Maintaining these pages

See the [GitHub Pages publishing guide](GITHUB_PAGES.md) for sources, bilingual routes, validation and deployment. Publishing the onboarding UI changes no contract, opens no intake and publishes no new release by itself.
