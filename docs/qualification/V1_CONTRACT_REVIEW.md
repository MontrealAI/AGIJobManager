# v1.0 internal contract review

Date: 2026-09-18. Review baseline: `a855a2d6bc10ca42d697142727d63a72631d7096`.

This is a bounded internal source review of the v1.0 release candidate, not an independent security audit or a claim that production commissioning is complete. No new reproducible fund-loss, duplicate-settlement, or role-bypass defect was identified in the paths reviewed. That conclusion is limited to the code and scenarios below; it is not a guarantee that no vulnerabilities exist.

This review inspected source and existing test assertions. It did not execute the test suites itself. Use the release's exact-source CI and validation evidence for execution results.

## Scope and findings

| Area | Source reviewed | Result and boundary |
| --- | --- | --- |
| Incoming USDC | `TransferUtils.safeTransferFromExact`; manager `createJob`, `applyForJob`, `disputeJob`; `JobValidation.record` | Deposits require exact recipient balance increases. Native mainnet/Sepolia USDC is pinned by the manager constructor; arbitrary tokens are limited to local development chain IDs. |
| Reserve conservation | `SettlementLedger`; `JobSettlement._finish`, `_validators`, `complete`, `refund`, `unresolved`; manager `withdrawableUSDC` | Five reserves cover escrow, agent bonds, validator bonds, dispute bonds and deferred claims. Terminal settlement releases the job obligations once and allocates outgoing entitlements. Owner withdrawals subtract all five reserves. |
| Payment failures | `JobSettlement._pay`, `claim`; manager `executeUSDCTransfer` | Each immediate outgoing payment uses an isolated, gas-bounded self-call. A failed call leaves an entitlement reserved for the original beneficiary. A token that mutates balances and then returns false is reverted inside that subcall. A failed retry reverts the claim deletion. The isolated transfer entry point requires both a self-call and an active reentrancy guard. |
| Non-delivery | Manager `expireJob` | After the assignment deadline, an assigned job with no completion request can be expired by anyone. The buyer receives escrow and the agent bond, immediately or as reserved claims. Submission is inclusive at the deadline; expiry is strictly after it. |
| Bad or unsupported work | Manager `disputeJob`, `finalizeJob`, `resolveDisputeWithCode`, `resolveStaleDispute` | No votes, insufficient quorum or a tie open a dispute instead of paying automatically. Manual disputes remain possible through the longer of full review and an applicable approval challenge. A buyer win preserves the full escrow; reviewer rewards come from forfeited collateral. Quality itself is judged by people or external evidence processes. |
| Explicit buyer acceptance | Manager `acceptJob`; `JobSettlement.complete` | Only the employer can accept submitted, undisputed work. Acceptance does not grant reputation and does not slash dissenting reviewers. Existing participating approvers may still receive the job's validator reward allocation. |
| Unanswered arbitration | Manager `refundUnresolvedDispute`; `JobSettlement.unresolved` | Anyone can close an unanswered dispute strictly after twice the dispute review period, returning escrow and every participant's own bond. This is a neutral exit, not a finding that the work was good or bad. |
| Reviewer and resolver conflicts | `JobValidation.record`; `ENSOwnership.validatorCredential`; manager `_requireIndependentResolver` | Each job rejects duplicate voter, credential and known-controller use. Buyer/agent wallets and known party-controlled credentials cannot vote. A resolver cannot be a party, voter or recorded validator controller. Ordinary resolution requires moderator status; the stale backstop requires ownership and the elapsed deadline. Hidden common control remains outside these checks. |
| Pauses and deadlines | Manager `_setSettlementPaused`, `_deadline`, `_settlementDeadline`, `getJobDeadlines` | Settlement pauses extend assignment, review, challenge and arbitration deadlines by paused time. Intake-only pauses stop posting/assignment while allowing exits. Full settlement pauses also block claim retries and neutral refunds. No automatic maximum pause duration is enforced. |
| Owner changes | Manager `_requireEmptyEscrow` and owner setters | Review/challenge periods, vote quorum/thresholds, slashing, ENS roots/registry and NFT collection changes are blocked while live job reserves exist. Settlement-wallet changes additionally require intake paused. Pending claims do not prevent these changes, but retain their original beneficiaries. Bond policy, admission lists and moderation remain operational owner powers as described below. |
| Hooks and completion NFTs | Manager `_callEnsJobPagesHook`, `_mintCompletionNFT` | ENS hooks use bounded gas and do not determine settlement success. Contract employers receive a bounded safe-mint attempt followed by a plain mint if the receiver rejects it. These optional integrations do not grant a right to redirect escrow. |

## Owner-mutation boundaries

- The validator reward percentage and NFT requirement are recorded when the buyer posts the job. Later changes affect newly posted jobs.
- The agent bond is determined when the agent applies. An owner bond-policy or duration-limit change can therefore affect a posted but unassigned job. It does not rewrite a bond already deposited.
- The first validator vote fixes the per-validator bond for that job, including a valid zero bond. Subsequent policy changes do not change the bond required from later reviewers of that same job.
- Allowlist/Merkle admission, blacklists and moderator membership can change during live jobs. Identity locking does not freeze these governance powers. Recorded votes are retained; new participants are checked against current admission rules.
- An owner cannot use the USDC rescue functions to withdraw backing for live obligations or deferred claims. Generic token rescue rejects both the settlement token and the manager itself.
- Owner access is deliberately retained: renouncing ownership is disabled and transfer uses the two-step ownership mechanism. Owner compromise, loss or prolonged pausing remains an operational risk.

## Accounting reasoning

For an agent win, the job cost is allocated to reviewer rewards, the fixed 30% and 10% recipients, and the agent. Integer division remainder and unallocated reviewer reward go to the agent. Validator bond returns and slashing are accounted for separately from that job cost. Agent and dispute bonds are separately released to the agent on this outcome.

For a buyer win, the reviewer reward budget is capped by the forfeited agent bond. The buyer's entire original escrow is preserved; remaining forfeited collateral and applicable rounding are returned to the buyer. The fixed 30% and 10% shares are absent from refund paths.

For a neutral timeout, each participant gets their own bond back and the buyer gets the original escrow. In all outcomes, a failed outgoing transfer changes the type of liability from a job reserve to a deferred claim; it does not make those funds owner-withdrawable.

These statements assume the native USDC contract continues to provide its expected transfer and balance semantics. Issuer transfer restrictions can leave correctly reserved claims unpayable until restrictions are lifted. The protocol cannot override the issuer or recover a lost beneficiary key.

## Existing regression evidence inspected

The review checked assertions in these files; their presence is not a substitute for a passing execution on the release source:

- `test/buyerProtection.v095.test.js`: exact bond reads; buyer acceptance; full review and longer challenge; strict/inclusive deadline boundaries; full escrow refunds; no-submission expiry; credential/controller conflicts; pause-aware clocks; neutral timeout; blocked recipients; issuer pause; owner withdrawal exclusion; false-after-transfer rollback.
- `test/disputeHardening.test.js`: dispute-state voting freeze, duplicate stance rejection, stale resolution, manual and validator-triggered dispute bonds, terminal refunds.
- `test/mainnetGovernanceAndOps.regression.test.js`: live-job governance locks, mutable admission roots, pause separation, bounded failing hooks, identity-lock limitations.
- `test/pausing.accessControl.test.js`: role enforcement, intake-only continuation, full settlement freeze and donation-only withdrawals.
- `test/operationalDurability.test.js`: configurable capacity and bond updates while jobs exist.
- `test/economicSafety.test.js`: reward-budget bounds and independence of NFT eligibility scores from payout shares.
- `test/invariantSeededSequence.test.js` and `test/scenarioEconomicStateMachine.test.js`: deterministic lifecycle/accounting scenarios. Their coverage is bounded, not exhaustive.

## Remaining production evidence

1. Independent review of the exact deployed source, compiler settings, linked libraries and ownership setup.
2. Live-signing rehearsal and verified operator/recipient/ENS/NFT configuration.
3. Reviewer and arbitration availability, costs, conflict handling and economic stress assessment for the intended job sizes.
4. Monitoring and practiced pause/recovery procedures, including beneficiary claims and unavailable signers.

A dishonest agent can submit unusable material before expiry; it then enters the review/dispute process rather than the no-submission path. If arbitration is unavailable until the neutral exit, the buyer recovers escrow but the agent receives its own bond back. Conversely, an honest agent can lose payment when an unresolved dispute reaches that neutral exit. Neither result is solved by assuming that a bond alone proves honest behavior. See [buyer protection](../BUYER_PROTECTION.md), [game theory](../game-theory.md) and the [launch checklist](../LAUNCH_CHECKLIST.md).

## Reviewed source fingerprints

| File | SHA-256 |
| --- | --- |
| `contracts/AGIJobManager.sol` | `aae9d1bc02f9bbb0fc02ad2ae674fd24028fbbfb2d5e6a9e984f214b61c9dbe5` |
| `contracts/utils/JobSettlement.sol` | `0e38c450b7461f36d30ec0aa06488135cf690dec0c8822b837f6f1b273a7cd93` |
| `contracts/utils/JobValidation.sol` | `0f085da143a6ecbd3f7d941945a86dd54ad4bd27834457041f75bcab782a615d` |
| `contracts/utils/JobState.sol` | `1840624830777ffbaedb5aada50d3f748f2f7aa89f788f329d9e598ff1b37459` |
| `contracts/utils/TransferUtils.sol` | `797242b5d1ac32547e065a0989d8f407a3f5a22618e98681a332d3e85197ce36` |
| `contracts/utils/BondMath.sol` | `f082b47230121bd98c9a2c4c5c0957734461f2fbf612b2386e249fa4b4b3fa30` |
| `contracts/utils/ENSOwnership.sol` | `5178a64b4618bf861a300b57fa4c4ca183313c46005509e14dc0c87ca8254209` |
| `contracts/utils/ReputationMath.sol` | `c742c3e7cb05a412405e8fe29d5283b1464e6c377ce98e2d8a360f96f3e3522c` |
