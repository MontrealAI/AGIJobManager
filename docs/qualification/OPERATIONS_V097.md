# Operations and console review — v0.9.7

v0.9.7 corrects operating instructions and an owner/moderator console permission mismatch. The only production Solidity source edit is the wallet-rotation NatSpec comment: live escrow and bonds must be empty, while reserved payment claims keep their original beneficiaries. The executable manager and library bytecode, ABI, storage layout, settlement formulas and permissions remain unchanged from v0.9.6.

## Corrections

- The console now permits the accepted owner to use `resolveStaleDispute` without requiring moderator membership. An admitted moderator uses `resolveDisputeWithCode`; ownership alone does not grant that separate permission. The proposed successor retains the distinct ownership-acceptance path. Malformed role values fail closed, and contract simulation still enforces timing, job state and resolver conflicts before signing.
- Confirmation text identifies the actual required role. Wallet-rotation confirmation explains that previously reserved claims keep their original recipients.
- Incident, known-limitation and trust-model guides now agree that settlement pauses stop lifecycle clocks and extend wall-clock deadlines. Intake-only pauses do not; claim retries are blocked during settlement pauses.
- Accounting guidance includes `lockedClaims` in surplus calculations and solvency monitoring. Initial readiness checks all five reserves; wallet rotation and guarded policy changes have the narrower live escrow/bond condition.
- Owner recovery instructions count eight libraries plus the manager, nine contracts in total. NFT guidance follows each job's recorded policy and explains the empty-registry default.
- The [launch checklist](../LAUNCH_CHECKLIST.md) connects operator decisions to actual evidence without implying that a software release has completed production signing, independent review, deployment or activation.
- Current interfaces and documentation identify v0.9.7. Migration history now distinguishes the v0.9.4 NFT policy, v0.9.5 buyer protections and v0.9.6 exact-bond getter.

## Compatibility

A verified v0.9.6 manager remains compatible with the v0.9.7 console. The console preserves its v0.9.6 local-storage namespace, while continuing to validate chain, wallet and manager before writes. Existing jobs are not migrated. v0.9.5 and older managers lack `getJobBonds` and must retain their original compatible interfaces for existing jobs; the older quotation limitation remains documented in [the v0.9.6 review](BUYER_ECONOMICS_FOLLOWUP.md).

The embedded protocol terms remain verbatim source text. The adjacent current-refund guidance continues to explain implemented escrow outcomes and reserved USDC claims. No commercial, arbitration-service or production-support commitment is introduced.

## Qualification scope

The release requires all five workflows to pass on its exact frozen source: contracts, UI/browser/accessibility, documentation, security and native-USDC/ENS forks. The local comparison verifies manager and production-library creation/runtime bytecode, ABI and link references against the v0.9.6 artifacts. Manager runtime remains 24,359 bytes, leaving 217 bytes below EIP-170.

Seven administrative-console regressions cover owner backstop access, moderator isolation, ordinary moderator decisions, owner-without-moderator rejection, malformed role values, proposed-owner acceptance and rejected simulation. Existing accounting, pause, NFT, dispute and payment-claim regressions continue to qualify the unchanged contract rules.

The full Slither review retains its source-bound observations and dispositions; no detector is disabled. The pinned cutover report is regenerated from execution with the v0.9.7 source/package hashes and preserved legacy observations. Historical release evidence remains unchanged. The final release validation record identifies actual results and CI runs.

Independent assurance, actual signing control, production recipients, ENS authority, participant availability and live-instance activation remain deployment-specific requirements. Publication broadcasts no Ethereum transactions.
