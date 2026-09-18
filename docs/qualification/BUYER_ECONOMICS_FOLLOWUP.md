# Buyer experience and economics follow-up — unreleased

This development update follows the published v0.9.5 release. It makes buyer outcomes and participant costs easier to understand and corrects a validator bond quotation bug. It does not change escrow distribution, fees, membership, NFT policy, arbitration powers or existing jobs. No live deployment or mainnet transaction is part of this update.

## Corrections

- The console now reads a job's recorded validator bond. Previously it recalculated from current owner defaults, which could quote the wrong allowance after another validator had fixed the job's bond. A fixed zero bond is distinct from a job without votes. Reads use one block; confirmation rechecks the effective amount and slash rate before voting.
- Posting and assignment distinguish total buyer escrow from agent earnings, wallet fees and the shared reviewer budget. Bonds and gas are separate. Unknown simulation amounts stay unknown instead of becoming guessed charges.
- Job report export handles exact large integer amounts. Job details refresh deadlines and recorded bonds. “Settled” does not imply that the agent delivered acceptable work: a buyer-win refund is also a settlement.
- The buyer guide explains missing delivery, a bad/inaccessible submission link, dispute funding, final acceptance, neutral timeout, deferred claims and gas costs. The copyable job template makes acceptance criteria explicit.
- Lifecycle, role, permission and USDC guides now agree on no-vote escalation, full buyer escrow refunds and isolated outgoing payments. The economic guide includes reviewer income, collateral risk, conflicting identities, arbitration availability and the limits of capped dispute bonds.

## Compatibility

`getJobBonds(jobId)` is a new **read-only** manager getter returning outstanding agent collateral, the per-reviewer bond amount, whether that amount has been fixed, and outstanding party dispute collateral. Terminal settlement clears those outstanding amounts; this is not a historical receipt. Unknown/deleted jobs revert. The function writes no storage, performs no external calls and changes no lifecycle rules or layout.

Published v0.9.5 and older managers do not expose this getter. The development console refuses to quote/send a validator vote if the exact bond read fails. Do not replace a deployed contract's interface with this development console and assume all actions remain compatible. The [published v0.9.5 console](https://github.com/MontrealAI/AGIJobManager/releases/download/v0.9.5/agijobmanager-usdc.html) remains the version-matched historical artifact; its current-default bond quote is the limitation corrected here. For an older manager, verify the first vote's actual collateral before approving subsequent votes; do not trust a recalculated quote after bond settings change.

Using the getter requires a separately deployed manager containing this source, after normal qualification. Existing jobs must finish on their original manager. No tag, release asset, old allowance, ownership, ENS namespace or pending claim is migrated by this change.

## Verification

The warning-free Solidity build has a 24,320-byte manager runtime, leaving 256 bytes below the 24,576-byte EIP-170 limit. ABI exports and generated references include the getter. Regression cases exercise fixed/non-fixed/zero bonds, owner default changes, actual second-voter debits, cleared terminal collateral and missing/deleted jobs, plus console quotation and export behavior.

The 23-case mainnet-fork cutover rehearsal was rerun. Its checked-in machine report differs from the v0.9.5 report only in the manager source hash; legacy inventory and ENS/USDC outcomes are preserved. This is pinned historical-state rehearsal, not proof of current signing authority or live-instance configuration.

Slither 0.11.6 was rerun with all 102 enabled detectors and the separate medium/high and reentrancy scans. All 115 distinct finding identities, severities and confidences exactly match the reviewed v0.9.5 set: 0 high, 9 medium, 36 low and 70 informational. The baseline updates only its review date and the inspected manager source hash; no finding was removed or silently accepted. This is internal review, not an independent audit.

The GitHub pull request checks must pass for the exact submitted source: contracts, UI/browser/accessibility, documentation, security, and native-USDC/ENS forks. Build and fork success do not establish that the economics are profitable for all participants. Check the [economic operating policy](../game-theory.md) and [live activation requirements](../MAINNET_READINESS.md) before opening paid intake.
