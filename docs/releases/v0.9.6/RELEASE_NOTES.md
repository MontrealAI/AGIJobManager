# v0.9.6 — Clear buyer outcomes and exact job economics

v0.9.6 makes costs and buyer recovery easier to understand and fixes validator collateral quotations after owner defaults change.

- **Exact bond costs:** the read-only `getJobBonds` getter exposes outstanding collateral and distinguishes a fixed zero validator bond from a job without votes. The console reads the recorded first-vote amount, checks it again before voting, and stops when an exact read is unavailable.
- **Clear participant economics:** previews separate total buyer escrow, agent earnings, wallet fees, the shared reviewer budget, collateral and gas. Unknown amounts remain unknown. Job reports preserve exact integer amounts.
- **Practical buyer protection:** the console and guides explain missing delivery, bad or inaccessible submissions, dispute funding, final acceptance, neutral arbitration timeout and reserved USDC claims. A copyable job template helps buyers define measurable acceptance criteria.
- **Observable settings:** `setValidatorBondParams` emits its declared update event. Changing defaults does not change collateral already fixed for a job.
- **Consistent interfaces:** current guides and generated artifacts identify v0.9.6. A separate console storage namespace avoids silently restoring an older manager or old forms.

The successful-job split is unchanged: **8% default shared reviewer budget, 30% and 10% wallet fees, and the remainder to the agent**. Agent/Club ENS membership, explicit admission exceptions and the posting-time NFT policy remain in force. The release preserves full buyer escrow refunds on a buyer win, no-vote dispute escalation, full review, conflict checks, pause-aware clocks, neutral timeout and protected payment claims introduced in v0.9.5.

## What if the agent fails?

| Situation | Buyer outcome |
| --- | --- |
| No submission by the deadline | Anyone can expire the job; the buyer receives escrow and the forfeited agent bond |
| Poor, incomplete or inaccessible submitted work | Open an on-chain dispute before the displayed cutoff; a buyer-win decision returns full escrow and the buyer's dispute bond |
| No votes, insufficient quorum or a tie | Finalization opens a dispute; it does not automatically pay the agent |
| Arbitration stays unanswered | After the neutral deadline, anyone can return escrow and each participant's own bonds, without fees or rewards |
| USDC transfer is restricted | The payment remains reserved for its original recipient and can be retried when permitted |

Acceptance and completed settlement are final. There is no built-in revision round, partial refund or chargeback, and refunds do not cover gas or lost time. Use separate milestone jobs for staged work.

## Qualification and compatibility

The release is pinned to application commit `2b1169ceef161cdc6667aead23b5ca89633f8579`. The complete archive includes source, CI evidence, validation notes and a content manifest; separate SHA-256 checksums cover the downloadable assets. Qualification covers contract regressions, UI/browser/accessibility tests, fuzzing and invariants, actual USDC/ENS fork rehearsals, deployment checks and documentation.

**A fresh v0.9.6 deployment is required.** v0.9.5 and older managers do not expose the getter. Existing jobs, allowances, interfaces, payment claims and ENS namespaces remain on their original contracts. No public-chain transaction is part of this release.

This is internal qualification, not an independent audit or a guarantee of incentive compatibility. Hidden common control, collusion and unavailable arbitration remain risks; owner pauses and USDC issuer restrictions can delay exits. An honest agent can remain unpaid after neutral timeout. Operators must fund independent review and arbitration and verify the actual deployed instance before opening paid intake.

Start with [buyer protection](https://github.com/MontrealAI/AGIJobManager/blob/v0.9.6/docs/BUYER_PROTECTION.md), [economics](https://github.com/MontrealAI/AGIJobManager/blob/v0.9.6/docs/game-theory.md), and [deployment](https://github.com/MontrealAI/AGIJobManager/blob/v0.9.6/hardhat/README.md).
