# Genesis Job 0: how the artwork job would run today

**Worked example, 18 September 2026.** The original job requested a ceremonial founding image. With the current contracts, a buyer who likes the submitted image can accept it and trigger payment immediately. Independent review is another route: ordinary finalization waits for the full review period and any later approval challenge. Neither a credential nor a completion link guarantees payment.

This example uses **100 USDC as an illustrative new budget**, the original 72-hour assignment duration, and current default settings. It does not value the artwork or convert the original 88,888 AGIALPHA into dollars. The [local simulation](../../scripts/simulate-genesis-job.mjs) executes 24 scenarios against the current contracts; it does not generate new artwork or run a live marketplace.

**Before a real posting:** the operator must supply a verified, commissioned USDC manager, its owner and both fee recipients, accepted participant identities, and available reviewers/moderators. This repository supplies no commissioned manager for this example. Existing Genesis Job 0 remains settled on its original contract. A new posting gets a new manager/job identity; publishing this guide does not reopen or migrate it. Follow [mainnet readiness](../MAINNET_READINESS.md) and choose the [current console or frozen release](../V1_RELEASE_SCOPE.md#published-download-versus-current-source).

## The original job, verified

The brief was **“Genesis Job 0 — Create the Ceremonial Founding Image of AGIJobManager Mainnet.”** It requested one square PNG, at least 2048 × 2048, showing a seated synthetic/post-human ceremonial figure in an ornate golden sanctuary, luminous circular structures and a vivid jewel-toned palette. The completion JSON had to point to a publicly retrievable final image.

| Historical fact | Value |
| --- | --- |
| Legacy manager / job | `0xB3AAeb69b630f0299791679c063d68d6687481d1` / `0` |
| Buyer, also the old manager owner | `0xa9eD0539c2fbc5C6BC15a2E168bd9BCd07c01201` |
| Assigned agent | `0x3B7205E05D015D06323B432E9813bCb3fe86adf7` |
| Escrow | 88,888 AGIALPHA; 18 decimals |
| Assigned | 6 March 2026, 22:57:47 UTC |
| Completion submitted | 7 March 2026, 00:11:35 UTC — 1 hour 13 minutes 48 seconds later |
| Review before settlement | Seven approvals, zero disapprovals |
| Finalization | 8 March 2026, 02:40:11 UTC; block 24,609,815; successful receipt |
| Completion receipt | NFT token `0`, minted to the buyer |

Sources: [settlement transaction](https://etherscan.io/tx/0x3c586d674d22bc93fb2ffbb83f5a4797ad699cb3a5d3cd7c18629beb2f2c4a5a), [verified legacy contract](https://etherscan.io/address/0xb3aaeb69b630f0299791679c063d68d6687481d1#code), [original specification](https://gateway.pinata.cloud/ipfs/bafkreie75ykl5o5mg3yuihxjn26rwwce5nyz5mo4k66l4lc2wmgkkdi4qe), [completion metadata](https://gateway.pinata.cloud/ipfs/bafkreigz2nznh42izu47ftvu5u67ofw2mm5qpua772m7dopaumqoukn3lu). The [archived evidence](genesis/README.md) includes the receipt and contract reads immediately before and after settlement.

The retrieved PNG was square, 2048 × 2048 and 9,229,472 bytes. Its SHA-256 was `49ad71211fa974af57a790ddb861a5cfe262a1531f3adc9cb5f86b56313030c9`. Visual inspection found the requested figure, gold setting, rings and palette. “Polished” remains a subjective judgment; this inspection does not establish licensing rights. Metadata bytes were checked against their raw IPFS CIDs; the PNG file hash is recorded without claiming a full DAG-PB CID proof. Retrieval worked through one public gateway, which does not guarantee continuing availability.

## Agree on a usable brief before funding

For a new job, keep the art direction but publish **new metadata** stating USDC, the correct chain and manager, and the new job ID when known. The old JSON explicitly names AGIALPHA, the old manager and a legacy NFT payout tier. It is historical evidence, not a ready-to-post USDC specification. An enabled identity NFT now establishes eligibility, not an 80% payout tier.

Start from the [buyer brief template](../BUYER_JOB_TEMPLATE.md) and fill in these decisions:

| Decision | Practical specification for this example |
| --- | --- |
| Work requested | A newly created ceremonial image with the original composition requirements; reuse the old image only if the buyer explicitly requests reuse |
| Technical delivery | One final square PNG, both dimensions at least 2048 pixels; publicly accessible image URI; completion JSON whose `image` field references that file |
| Repeatable evidence | Dimensions, file size and SHA-256; specification URI; final image URI; a checklist mapping every acceptance criterion to the deliverable |
| Visual assessment | Buyer/reviewers inspect the seated figure, luminous rings, golden sanctuary, jewel tones and overall quality; resolve subjective expectations with examples before posting |
| Rights and hosting | Agree permitted inputs, intended reuse rights, attribution, pinning duration and who maintains the files before funding; an NFT does not itself grant copyright |
| Price and time | Example total escrow: 100 USDC; duration: 259,200 seconds from assignment; agent proceeds depend on settlement route as shown below |
| Review and disagreement | Name a reachable independent moderator and evidence channel; arrange willing reviewers if review will be needed; publish the evidence process with the brief |

There is one on-chain completion submission, no revision round and no partial payment/refund. Exchange any preview and make revisions **before** the final submission. A new requirement after delivery needs a separate agreement/job. Do not put private credentials or confidential material in public IPFS metadata.

## A realistic participant journey

The buyer-acceptance route suits this example when the buyer can inspect the art personally. The buyer still pays the fixed 30% and 10% shares. Reviewers can participate before acceptance; the no-vote amounts below apply only if nobody has voted when acceptance executes.

| Stage | What the person or agent does | What must actually happen |
| --- | --- | --- |
| Prepare | Operator verifies the manager and current settings; buyer and agent agree the brief, economics and evidence process | Intake and settlement permit the required actions; an independent moderator is available for a dispute |
| Post | Buyer approves exactly 100 USDC, then posts the brief and 72-hour duration | Successful creation receipt locks 100 USDC; save the assigned job ID. Approval alone does not create it |
| Take the job — T0 | Eligible agent checks the posted terms, approves the quoted bond, and applies | First eligible successful application assigns the job immediately; there is no buyer selection queue or reserved named-agent slot |
| Produce | Agent creates the art, checks it against the brief, exports the PNG and uploads/pins the image and metadata | An external worker/agent runner performs this work. The manager does not supply an image model, dispatch workers or pin files |
| Submit before T0 + 72 hours | Assigned wallet submits the completion URI | Successful completion request starts review. The contract checks URI formatting, not the image's quality or accessibility |
| Inspect | Buyer opens the JSON and actual image, repeats technical checks and assesses visual criteria | A displayed thumbnail or a submitted link alone is insufficient. Keep evidence of defects before disputing |
| Accept satisfactory work | Buyer selects **Accept work and pay** and confirms | A successful transaction settles immediately, returns the agent bond, distributes USDC and mints the buyer's completion NFT. Acceptance is final |
| Verify and retain | Agent and buyer check receipts, balances and any reserved claims; preserve the pinned files | A wallet/RPC timeout is not proof of failure. Check the transaction hash and resulting state before retrying |

The historical delivery took 1 hour 13 minutes 48 seconds. That provides a concrete reference, **not a promise that today's agent can meet the same time**. A new run could finish within one working session if generation, pinning, wallet confirmations and buyer inspection cooperate; none of those off-chain steps is timed or guaranteed by the contract. If nobody applies, the assignment clock never starts and the buyer can cancel.

An owner-enabled free `*.alpha.agent.agi.eth` name plus Alpha Agent Identity NFT can satisfy admission. Registration still costs ETH gas, and the agent needs USDC collateral. Confirm the actual collection/root and job NFT requirement using the [agent guide](../roles/AGENT.md). The simulation uses mocks; it does not claim to register a live identity. Expiry after assignment does not by itself remove the assigned wallet's right to submit or receive an earned settlement.

## What each participant pays and earns

The table uses default 8% validator rewards, 5% agent base bond with its 72-hour duration premium, and 15% validator bonds. Read live quotes before signing: owner-configurable terms and posted snapshots matter. These amounts exclude ETH gas and work costs.

| For a 100 USDC job | Buyer accepts before votes | Three approving reviewers | Seven approving reviewers, as historically |
| --- | ---: | ---: | ---: |
| Buyer escrow spent on success | 100.000000 | 100.000000 | 100.000000 |
| First fee recipient | 30.000000 | 30.000000 | 30.000000 |
| Second fee recipient | 10.000000 | 10.000000 | 10.000000 |
| Each reviewer's reward | None | 2.666666 | 1.142857 |
| Agent's work proceeds | 60.000000 | 52.000002 | 52.000001 |
| Agent's own bond returned additionally | 5.129600 | 5.129600 | 5.129600 |
| Each reviewer's own bond returned additionally | None | 15.000000 | 15.000000 |
| Escrow plus all participation bonds initially needed | 105.129600 | 150.129600 | 210.129600 |

The last row is aggregate capital across participants, not a charge to the buyer or an amount all parties deposit at once. A possible buyer dispute needs another **1 USDC** under these defaults. Everyone who transacts also needs ETH. Returned collateral is not income. The one or two micro-USDC rounding remainder goes to the agent.

For example, with three approvals, the agent receives **57.129602 USDC** on successful settlement: 52.000002 work proceeds plus 5.129600 of its own money back. After its original bond deposit, its USDC balance has increased by 52.000002, before paying for work and gas. The buyer receives the completion NFT; the assigned agent receives payment. This receipt NFT is separate from the agent's identity NFT and does not certify copyright or future availability.

**Review participation must be economically plausible.** Three reviewers satisfy the default quorum in the all-approve scenario; the count alone never guarantees an approval majority. Their work, gas and capital cost must fit within roughly 2.67 USDC each for them to break even. Seven reviewers reduce that to roughly 1.14 USDC each. Check real wallet gas estimates and reviewer willingness before posting. A 100 USDC example is not a recommendation that seven mainnet reviewers are affordable.

The agent similarly needs generation, editing, hosting, transaction and capital costs below its actual proceeds to earn a profit. For this small subjective job, direct buyer inspection avoids requiring reviewers for a satisfactory immediate acceptance, but it depends on a responsive buyer. Arrange the disagreement path anyway. Use the [economics worksheet](../game-theory.md) with actual cost assumptions; do not treat a USDC balance increase as net business profit.

The performance bond puts funds at risk, but 5.129600 USDC collateral does not guarantee a satisfactory 100 USDC deliverable. Free identities do not prove independent operators; collusion or poor adjudication can still produce the wrong outcome. Buyer-owner and reviewer conflict checks help but cannot establish real-world independence. Honest work can remain unpaid if both buyer acceptance and adequate review/arbitration fail.

## When payment or a refund becomes available

Use the console's current `getJobDeadlines(jobId)` values. The following timeline assumes current defaults, no settlement pauses, and someone promptly sending each required transaction.

| Route | Earliest relevant condition | What follows |
| --- | --- | --- |
| Buyer accepts | Work submitted, undisputed and unsettled | Buyer can settle immediately; no seven-day wait |
| Independent review | Strictly after seven days from submission **and** any later one-day approval challenge | Someone finalizes; quorum and majority determine the outcome. More votes can change the majority while voting remains open |
| No completion submission | Strictly after 72 hours from assignment | Anyone can expire the job; buyer recovers escrow and agent bond |
| Submitted work needs a dispute | Buyer or agent submits a bonded dispute through the displayed settlement cutoff | Independent moderator can decide immediately; there is no mandatory 14-day moderator wait |
| Nobody adjudicates | Owner backstop after 14 dispute days; neutral refund after 28 dispute days, both strict boundaries | Conflicted owner cannot adjudicate. Anyone may trigger eligible neutral refund, returning escrow and original bonds without paying for work |

The ordinary-review simulation deliberately retains the historical March timestamps to make the difference measurable. It rejects the old 8 March settlement time and the exact new boundary, then succeeds on **14 March 2026 at 00:11:36 UTC**. Both the three- and seven-approval cases wait for the full review. The old configuration had approval/disapproval thresholds of five; this example keeps today's default three and quorum three.

In the no-vote simulation, a prompt finalization call opens a dispute after review, and neutral refund executes on **11 April 2026 at 00:11:37 UTC**. This is roughly 35 days after submission, not a promise of refund 28 days after submission. The 28-day clock starts at dispute opening. Late calls and settlement pauses move calendar dates; time alone never sends money. Owner pauses can delay exits indefinitely. After a neutral deadline, an eligible adjudication and refund can race; the first successful settlement wins.

## If something goes wrong

Every branch below ran locally at both 100 and 88,888 USDC. The latter is a numerical comparison only, not the historical token's dollar value. Figures here are for 100 USDC, with no gas reimbursement.

| Scenario | Action and observed result |
| --- | --- |
| Nobody takes the job | Buyer cancels before assignment and gets all 100 USDC back |
| Agent takes it but never submits | Anyone expires it after the deadline; buyer receives 105.129600 USDC: its 100 escrow plus the forfeited agent bond |
| Agent submits bad work or an empty/inaccessible link | Missing-submission expiry is no longer available. Preserve evidence and open a dispute before the cutoff; the contract cannot infer defects from a URI |
| Buyer disputes before votes and wins | Buyer deposits 1 USDC dispute bond; independent moderator awards buyer 106.129600 USDC: 100 escrow, its 1 bond, and agent's 5.129600 bond. No success fees |
| Three reviewers reject; moderator upholds buyer | Third disapproval opens a dispute. Buyer receives 100.000002 USDC; each correct rejecting reviewer receives 1.709866 reward from forfeited agent collateral plus its 15 bond back. No success fees |
| Buyer disputes satisfactory work; moderator upholds agent | With no votes, agent receives 60 USDC work proceeds, the buyer's 1 USDC dispute bond, and its own 5.129600 bond. Buyer spends 101 USDC total. Quality judgment is the moderator's input, not an automated fact |
| No votes and no arbitration | After the required calls and deadlines, buyer gets 100 escrow and agent gets its own bond back; agent's work remains unpaid. No fees or completion NFT |
| Buyer is also manager owner | That owner cannot decide its own dispute, even after the stale-dispute deadline; independent adjudication or neutral refund is needed |
| USDC blocks the agent recipient | Other eligible payments complete. With seven approvals, 57.129601 USDC stays reserved for the agent. Claim retry succeeds only after the restriction clears and pays the same wallet |
| Optional ENS settlement hook fails | USDC settlement and buyer NFT still succeed; inspect the failure event and check ENS permissions separately |
| Credentials disappear after assignment | Assigned wallet can still submit and receive successful settlement. The test removes mock credentials; it does not transfer a real soulbound NFT or simulate registrar expiry |

Keep checking the transaction receipt and job state: a disapproval vote is not itself a refund, and an active dispute cannot be settled through buyer acceptance. Incorrect reviewer votes may be slashed under adjudicated outcomes; explicit buyer acceptance does not punish dissenting reviewers or award reputation. Detailed rules and limits are in [buyer protection](../BUYER_PROTECTION.md).

## What the old screenshot's transfers and warning mean

The old settlement paid the agent **71,110.40 AGIALPHA** for work (80%), returned its **4,559.598848** bond, rewarded reviewers from a **7,111.04** pool (8%), and retained **10,666.56** in the old manager (12%). Each reviewer's displayed **14,349.062857142857142857** transfer combined a **13,333.20** bond return with a **1,015.862857142857142857** reward. The residual one AGIALPHA base unit went to the agent. These are legacy economics, not current USDC shares.

The successful receipt also contained two best-effort ENS `SET_AUTH` failures for hook `4`. Enclosing helper/manager hook events reported success because those internal failures were caught. The warning therefore does not mean the job payout or NFT failed, and it does not prove delegated permissions were cleaned up. Its exact root cause was not established. The current simulation uses a reverting mock hook to check payment isolation; it does not reproduce or repair that specific mainnet authorization failure. See [ENS troubleshooting](../TROUBLESHOOTING_DEPLOYMENT_AND_ENS.md).

## Reproduce the simulation

Use the repository's supported Node toolchain and committed lockfiles. From the repository root:

```bash
npm ci
npm --prefix hardhat ci
npm run simulate:genesis
```

The command compiles the current contracts, verifies archived file hashes and legacy ABI decodes, verifies the two raw metadata CIDs, then runs **12 paths × 2 prices = 24 scenarios**. It prints `ALL_SCENARIOS_PASSED=24` on success and writes `build/qualification/genesis-job.json`. To choose another report path:

```bash
npm run simulate:genesis -- --output /absolute/path/genesis-job.json
```

The report records the checkout commit, whether the worktree was dirty, relevant source hashes, assumptions, per-participant USDC changes, settlement events and local gas use. Each scenario checks exact expected balances, success-only NFT minting, conservation, an empty manager token balance and all five cleared reserve counters after any required claim retry. CI runs this rehearsal after compilation on shard 0 and uploads the report as the `genesis-job-simulation` artifact for that run.

**Evidence boundary:** local EDR chain 31337, mock USDC/ENS/NFT/helper, synthetic names, historical addresses impersonated locally, and disposable moderator/fee recipients. Public HTTP networks are removed from the runtime configuration; no mainnet transaction or current live identity check occurs. The EVM receives the assumed review/adjudication decisions; it does not prove art quality, reviewer independence, signer control, current gas costs or profitable participation. Local gas figures are not mainnet fee quotes. The separate [mainnet-fork qualification](../qualification/USDC_CUTOVER.md) and instance-specific launch checks cover different requirements.
