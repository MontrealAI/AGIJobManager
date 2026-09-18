# v0.9.7 — Correct console permissions and clear launch guidance

v0.9.7 fixes an administrative-console permission mismatch and brings current operating instructions into agreement with the contract.

- **Correct dispute access:** the owner can use the overdue-dispute backstop without moderator membership. Ordinary dispute decisions still require an admitted moderator. The console identifies the required role and simulates the transaction before signing.
- **Accurate payment and pause guidance:** settlement pauses stop lifecycle clocks and extend calendar deadlines. Reserved USDC claims count toward protected funds and keep their original beneficiaries after recipient rotation.
- **Practical launch checklist:** operators can record signing control, recipient addresses, ENS membership, reviewer availability, NFT configuration, rehearsal results and actual deployment evidence. A fresh manager requires NFTs but has no registered collections; operators must configure reviewed collections or explicitly choose optional mode.
- **Consistent release:** current guides, generated artifacts and package versions identify v0.9.7. Existing v0.9.6 console settings remain available, with chain, account and manager validation before writes.

## Compatibility and economics

**Verified v0.9.6 managers remain compatible; no redeployment is needed for this console update.** Production manager/library executable bytecode, ABI and link references are unchanged. The only production Solidity edit corrects a documentation comment. v0.9.5 and older managers must retain their compatible interfaces for existing jobs; they lack the exact-bond getter required by the current voting console.

The default successful-job split remains **8% shared reviewer budget, 30% and 10% wallet fees, and the remainder to the agent**. Bonds and gas are separate. Buyer-win outcomes return full buyer escrow, with reviewer rewards funded from forfeited collateral and no 30%/10% fees. No votes, insufficient quorum or a tie lead to a dispute rather than automatic payment. Existing full review, explicit acceptance, conflict checks, neutral timeout and reserved-payment rules are preserved.

| If the agent or process fails | Available outcome |
| --- | --- |
| No submission by the deadline | Anyone can expire the job, returning escrow and the forfeited agent bond to the buyer |
| Poor, incomplete or inaccessible submission | The buyer must dispute before the displayed cutoff; a buyer-win decision returns full escrow and the buyer's dispute bond |
| Arbitration remains unanswered | After the neutral deadline, anyone can return escrow and each participant's own bonds without fees or rewards |
| An outgoing USDC transfer fails | The amount remains reserved for its original recipient and can be retried when permitted |

Refunds and settlement require successful transactions. Acceptance and completed settlement are final; gas, lost time and outside losses are not reimbursed. Work quality still requires human or independently operated assessment, and neutral timeout can leave honest work unpaid.

## Qualification

Application commit: `e947b5f3b599e1e13f2076e807d80309ea3b3193`. The release records all five source-CI workflows, validation results, a content manifest and SHA-256 checksums. Local qualification includes 489 contract/console regressions, 178 UI tests, 31 pinned fork scenarios and 35 standalone-console checks. CI additionally checks browser journeys, accessibility, security headers, fuzzing, invariants and deployment tools. The full Slither scan retains the same 115 reviewed observations with no detector disabled.

This publication supplies software. It does not deploy or activate a mainnet instance, populate production addresses, or complete an independent audit. Owner/moderator trust, hidden common control, collusion, review costs and USDC issuer restrictions remain operating considerations. Historical releases and deployment records are preserved.

Start with the [launch checklist](https://github.com/MontrealAI/AGIJobManager/blob/v0.9.7/docs/LAUNCH_CHECKLIST.md), [buyer protection](https://github.com/MontrealAI/AGIJobManager/blob/v0.9.7/docs/BUYER_PROTECTION.md), and [economics](https://github.com/MontrealAI/AGIJobManager/blob/v0.9.7/docs/game-theory.md).
