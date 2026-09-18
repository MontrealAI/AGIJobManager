# v1.0.0 — USDC jobs, clear roles and buyer recovery

AGIJobManager 1.0 brings together USDC job escrow, bonded review, buyer recovery, a guided participant console and the operating tools needed to qualify an actual deployment.

## What changes in 1.0

- **Choose your role:** the existing console now starts with Buy work, Do work or Review work. Buyers are no longer steered toward agent credentials they do not need. Agents and reviewers see their own requirements, including the distinction between the console's ENS path and approved contract-level exceptions.
- **Honest readiness:** wallet connection and terms acceptance no longer imply that the manager has been verified. Setup guidance remains locked until the deployed manager and native-USDC checks succeed, and every transaction still has its own checks.
- **Buyer recovery at hand:** a direct control opens the existing explanation of missing delivery, poor work, disputes, neutral refunds and reserved payments. Accepting work remains a deliberate final settlement action.
- **See the economics before committing:** a new offline scenario tool compares agent win, buyer win, explicit acceptance and neutral timeout. It separates returned collateral from income and subtracts supplied work, review, gas and capital costs using exact USDC arithmetic.
- **A complete operating handoff:** release scope, compatibility, observed-user acceptance instructions, an internal contract review and the launch checklist identify both the available safeguards and the evidence still required for production.

The changes add 26 focused regressions: 13 for participant guidance and 13 for economic scenarios, including invalid inputs, reviewer dilution, rounding and extreme arithmetic. No production contract source, dependency or economic rule changed from v0.9.7.

## Payment and protection

For a successful 100 USDC job with the default rate and qualifying approval reviewers: **8 USDC shared reviewer budget, 30 USDC to wallet one, 10 USDC to wallet two and 52 USDC base agent earnings**. Rounding and unused allocations go to the agent; bonds and ETH gas are separate. The job records its reward rate when posted.

| Situation | Available contract outcome |
| --- | --- |
| No agent assigned | Buyer can cancel and recover escrow |
| No submission by the assignment deadline | Anyone can expire the eligible job; buyer receives escrow and the forfeited agent bond |
| Poor, incomplete or inaccessible submission | Dispute before the displayed cutoff; a buyer-win decision returns full escrow and the buyer's posted dispute bond |
| No votes, insufficient quorum or a tie | Finalization opens a dispute; it does not automatically pay the agent |
| Arbitration remains unanswered | After the neutral deadline, anyone can return escrow and everyone's own bonds, without work/review rewards or wallet fees |
| Outgoing USDC payment fails | A reserved claim remains payable to its original beneficiary and can be retried when restrictions permit |

Full buyer escrow refunds do not charge the 30%/10% wallet shares. Buyer-win reviewer rewards come from forfeited collateral. Refunds and settlement require successful transactions; time passing alone sends nothing. Completed settlement has no built-in chargeback, partial settlement or revision round. Gas and outside losses are not reimbursed.

## Compatibility

**Verified v0.9.6 and v0.9.7 managers remain compatible with the 1.0 console.** Production executable bytecode and ABI are unchanged; a console update does not require redeployment. Existing jobs, claims, allowances, receipts and ENS namespaces stay with their original contracts. The console retains the v0.9.6 storage namespace and validates the live context before writes.

v0.9.5 and older managers lack the exact-bond getter used by current voting; keep their compatible interfaces for their existing jobs. First deployments require the manager, all eight linked libraries, accepted ownership and the instance-specific launch checks.

## Verification and use

Frozen source: `790facbcb0a9e9c2fea52a038b7c80fc2ba12795`. All five recorded source workflows are required to pass before publication. Local checks passed 515 contract/console regressions, 178 UI tests, 31 fork scenarios and 35 standalone-console checks. CI additionally covers browser journeys, accessibility, security headers, deployment tools, fuzzing, invariants and deterministic distribution builds. The full Slither scan retains the same 115 reviewed observations; the internal review is not an external audit.

Download the standalone console or the complete ZIP together with `SHA256SUMS.txt`. The archive contains frozen source, documentation, CI evidence and `RELEASE_MANIFEST.json`. The console requires a wallet, internet access and a verified mainnet manager; no live deployment address is supplied.

For an offline, explicitly hypothetical economic example, run `npm run economics:check -- --example` from the source after installing the documented dependencies. Replace the sample assumptions before making operating decisions. A positive modeled margin does not prove incentive compatibility or reviewer independence.

The 1.0 label identifies this software edition. Production launch still needs actual signing and configuration evidence, independent security review, observed user sessions, reliable review/arbitration and monitoring. Owner pauses, hidden common control, collusion, unavailable arbitration and USDC issuer restrictions remain operating limits. This publication deploys no contracts and broadcasts no public-chain transactions.

Start with [the participant guide](https://github.com/MontrealAI/AGIJobManager/blob/v1.0.0/docs/START_HERE.md), [release scope](https://github.com/MontrealAI/AGIJobManager/blob/v1.0.0/docs/V1_RELEASE_SCOPE.md), [buyer protection](https://github.com/MontrealAI/AGIJobManager/blob/v1.0.0/docs/BUYER_PROTECTION.md), [economics](https://github.com/MontrealAI/AGIJobManager/blob/v1.0.0/docs/game-theory.md), or [the launch checklist](https://github.com/MontrealAI/AGIJobManager/blob/v1.0.0/docs/LAUNCH_CHECKLIST.md).
