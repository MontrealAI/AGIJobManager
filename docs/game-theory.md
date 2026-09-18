# Economics and operating limits — v1.0.0

The contract provides escrow, bonded review, and a trusted arbitration backstop. It does not prove work quality or guarantee that honest behavior is always the most profitable choice.

The [Genesis artwork simulation](examples/GENESIS_JOB_TODAY.md#what-each-participant-pays-and-earns) applies these rules to a 72-hour job, compares buyer acceptance with three or seven reviewers, and separates earned rewards from returned collateral.

## What the buyer purchases

A successful 100 USDC job at default rates allocates 8 USDC to correct-side validators, 30 to one configured wallet, 10 to the other, and 52 to the agent. These charges are included in the posted job cost. With explicit buyer acceptance and no votes, the unspent validator budget goes to the agent: 30 / 10 / 60. No-vote finalization itself opens a dispute and pays nobody.

The reward rate is fixed at posting and can be 1–60% for future jobs. At 60%, the base agent percentage is zero; operators should choose prices and rates that can fund the actual work and review. Participants also fund their own bonds and gas.

### A concrete 100 USDC example

These figures assume the default settings, a one-day job, a 10,000,000-second duration limit, and three independent reviewers voting on the eventual winning side. Read the actual manager settings before committing funds. One USDC has 1,000,000 integer units.

| Item | Amount | Meaning |
| --- | --- | --- |
| Buyer escrow | 100 USDC | Total job cost, including successful-job fees |
| Agent bond | 5.0432 USDC | Separate collateral; includes the duration premium |
| Each reviewer's bond | 15 USDC | Separate collateral, fixed for this job at its first vote |
| Buyer/agent dispute bond | 1 USDC | Posted by a party opening a dispute |
| Successful-job wallet fees | 30 + 10 USDC | Paid only on an agent-win/accepted-work outcome |
| Each of three correct approval reviewers | 2.666666 USDC reward | Own bond also returned; transaction gas is separate |
| Agent's successful-job earnings | 52.000002 USDC | Includes two rounding units; own bond also returned |
| Each of three correct rejection reviewers on a buyer win | 1.681066 USDC reward | Here the 5.0432 agent bond caps the reward funding; assumes no incorrect votes |
| Buyer's refund in that rejection example | 100.000002 USDC | Full escrow plus two rounding units; the buyer's dispute bond, if posted, also returns |
| Incorrect reviewer's penalty | 12 USDC | Default 80% of a 15 USDC bond; explicit buyer acceptance and neutral timeout do not slash |

Reviewer rewards are **shared**, not paid at 8% to every reviewer. Review gas and effort can exceed a 2.666666 USDC reward, especially on mainnet. More correct reviewers divide the same budget further. Do not recruit reviewers on the assumption that voting is always profitable or that a bond is an additional fee.

The neutral arbitration timeout returns the buyer's 100 USDC and everyone's own posted bond, but pays nothing for the agent's work or the reviewers' effort. The successful-job wallet fees do not create an on-chain obligation for those recipients to supply reviewers or moderation; publish the actual service commitments separately.

## What discourages bad behavior

| Risk | Contract protection | Remaining limit |
| --- | --- | --- |
| Agent does not submit | Deadline expiry returns full buyer escrow and forfeits agent bond | Bond may be small relative to buyer's delay or opportunity cost |
| Agent submits poor work | Full review, explicit dispute, full escrow refund on buyer win | Validators/moderators must actually inspect the evidence |
| Nobody reviews | No automatic agent payout; arbitration then neutral refund | Honest agent may remain unpaid if buyer/reviewers/arbitrators do not cooperate |
| One ENS holder uses many operators or names | One vote per credential and recorded controller; parties cannot vote | Multiple wallets under undisclosed common control remain possible |
| Biased arbitration | Job parties, voters and recorded controllers cannot adjudicate | Independent-looking addresses can still collude; owner appoints moderators |
| Reviewer votes against final outcome | Default 80% bond slash, distributed with rewards | Matching the final outcome is not an objective proof of truth; visible votes allow herding/bribery |
| Buyer disputes correct work to delay payment | Dispute bond goes to the winning side | No oracle forces timely independent arbitration; dispute bond is capped |
| Recipient cannot receive USDC | Protected payment claim; other recipients can be paid | USDC issuer can still restrict the recipient or entire manager |

There is no random reviewer assignment or hidden-vote process. Votes are visible and the first 50 eligible voters fill the available slots. ENS membership limits admission; it does not establish independent human or organizational control. The contract compares voter/controller addresses with the buyer and assigned-agent wallets, but does not discover a party's other wallets or snapshot the agent's ENS controller as a separate party identity. Disclosed conflicts need an operating policy as well as the address-level checks. Buyer/agent self-dealing through cooperating identities can also distort reputation; reputation is not proof of external customer satisfaction.

Quorum and early thresholds have different jobs. With default quorum 3, two approvals and one rejection form a valid majority after the full review window, even though the three-approval early threshold was not reached. Three early rejections open a dispute for adjudication; they do not instantly refund the buyer. Encourage independent inspection of the criteria before voting, not following the visible majority.

The dispute bond is 0.5% of job cost, with a 1 USDC minimum and 200 USDC maximum, also capped by job cost. For a 100,000 USDC job, 200 USDC is only 0.2% of escrow. This discourages some frivolous disputes but does not prove that delay attacks are unprofitable. Large or subjective work needs funded milestones, prompt arbitration and exposure limits.

## Reviewer funding on a buyer win

The buyer gets **100% of the job escrow back**. Correct disapprovers receive their bond plus a share of the smaller of the posted reward budget and forfeited agent bond, plus slashed incorrect-validator collateral. If there are no correct disapprovers, no base reviewer budget is taken. Rounding and unallocated collateral go to the buyer. The default agent bond can be smaller than an 8% reward budget, so failed-job review rewards are not guaranteed to equal 8% of job cost.

No-action arbitration timeout returns everyone's own funds without rewards or penalties. Agents and reviewers must account for that possible unpaid work when accepting a job.

## Check whether participants can afford this job

The console already previews the job split and exact bonds. The offline scenario tool adds a separate question: **after work, review, gas and capital costs, who can still afford to participate?** It performs no network calls and supplies no market prices or success probabilities.

From the repository root, run the clearly labeled hypothetical example:

```bash
npm run economics:check -- --example
```

Copy [example.json](../scripts/economics/example.json), replace every assumption with your own figures, and run:

```bash
npm run economics:check -- path/to/my-job.json
npm run economics:check -- path/to/my-job.json --json
```

Use the job's recorded reward percentage and actual posted bonds; for an unposted job, use the console's current bond preview and refresh before committing. `getJobBonds(jobId)` reports the recorded agent bond and whether the reviewer bond has been fixed by the first vote. Read the current slash setting from the same manager. The tool does not fetch or verify these values. Record the manager, chain, block/job reference or hypothetical source in `assumptionSource`.

All USDC amounts must be quoted decimal strings with at most six decimal places; counts, the reward percentage and slash basis points are integers. Set `approvals` and `rejections` explicitly: reviewer rewards are shared only among voters matching the final outcome. Enter a single all-in `agentCostUSDC` and a per-voter `reviewerCostUSDC`, including effort, transaction gas converted using your own assumption, and any cost of locked capital. These estimates are applied consistently across the four counterfactuals; revise them for a different cost case. **Do not put returned bonds in the cost estimate:** the tool already subtracts each participant's own posted collateral when computing net income, so only forfeited collateral reduces that income. For a party-funded dispute, also supply its actual bond and initiator. Use `none` and `"0"` when no party bond is posted; automatic disputes can still exist in that case.

Net figures treat job-participant and settlement-wallet allocations as going to separate beneficiaries. The contract permits a settlement wallet to be the agent, buyer or a reviewer. If a participant also receives that share, add it to their reported receipt and net; the tool has no addresses and cannot detect overlapping beneficiaries or common ownership. For example, an agent who also receives the 30% share on a 100 USDC job has 30 USDC more income than the agent-role figure alone. This does not change the total allocated by the protocol.

For the bundled 100 USDC example, the assumed agent cost is 45 USDC and each reviewer's assumed cost is 3 USDC. Those costs are invented for illustration, and the table assumes separate settlement-wallet beneficiaries:

| Outcome and vote assumption | Agent net after assumed cost | Each participating reviewer's net after assumed cost |
| --- | --- | --- |
| Agent wins; three approvals | +7.000002 USDC | −0.333334 USDC |
| Buyer wins; change the example to three rejections | −50.0432 USDC, including the forfeited agent bond | −1.318934 USDC |
| Neutral timeout; either vote pattern | −45 USDC | −3 USDC |

This exposes a practical problem even when successful-job accounting balances: a 100 USDC job can fund the agent's assumed cost while underpaying the reviewers. Raising the shared reviewer percentage reduces the agent's base share; increasing the number of reviewers divides the pool further. Slashed collateral is uncertain compensation and should not be the operating budget for honest review. A returned 15 USDC reviewer bond is recovery of collateral, not 15 USDC of earnings.

The report compares adjudicated/review agent wins, buyer wins, explicit buyer acceptance and unanswered-arbitration timeout. It checks integer-unit fund conservation, rounding, absent correct reviewers and bond losses, and marks acceptance as unmodeled when a party dispute bond is supplied. Acceptance always requires an undisputed submitted job on-chain; zero bond alone does not establish that condition. Agent-win calculations with no reviewers describe a possible adjudicated outcome, never automatic no-vote payment. Unassigned cancellation and no-submission expiry are outside the tool: **expiry forfeits the agent bond; neutral arbitration timeout returns it.**

Treat the output as scenario analysis, not an eligibility check, live quote, guarantee of immediate payment, or certification that incentives are sound. A recorded payment can become a deferred claim. The tool does not value the work for the buyer, calculate buyer delay losses, establish reviewer independence, determine an adjudication, or verify quorum and deadlines. A positive margin cannot establish any of those things.

## Practical operating policy

Use measurable acceptance criteria and accessible, content-addressed evidence. Separate large work into funded milestone jobs; there is no built-in partial settlement. Recruit enough genuinely independent reviewers before posting work, budget their gas and effort, and keep quorum within the participating group. Normal AGI Agent and Club ENS membership and the per-job NFT policy remain in force; treat allowlist/Merkle exceptions as explicit trusted governance decisions.

Publish the fee split, all timers, collateral requirements, moderator availability and evidence process before users commit funds. Use a controlled canary and measured exposure limits, monitoring disputes, abstention, claim balances and time to payment. Owner settlement pauses stop lifecycle clocks and can delay all exits indefinitely; intake-only pauses do not stop those clocks. A software release and fork rehearsal do not replace verification of the actual deployed wallets, owner and ENS control.

Before opening paid intake, establish who will inspect work and arbitrate conflicts, how quickly they will act, and how users can submit evidence. Check that the agent's net earnings can fund the promised work and that each reviewer's expected reward can cover review effort, gas and collateral risk. Use the [buyer job template](BUYER_JOB_TEMPLATE.md). If those participants are unavailable or the economics do not cover their costs, reduce the scope or defer posting; the contract cannot supply them.

Exact arithmetic: [USDC distribution](USDC_PAYOUT_SPLIT.md). User outcomes: [buyer protection](BUYER_PROTECTION.md). Deployment checks: [mainnet readiness](MAINNET_READINESS.md).

Explicit buyer acceptance does not slash dissenting validators or award reputation; it waives further review rather than adjudicating the truth of their votes. Normal adjudicated outcomes retain the configured slashing rules.
