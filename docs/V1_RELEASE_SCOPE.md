# AGIJobManager 1.0 — release scope

AGIJobManager coordinates USDC-funded jobs, bonded review and buyer recovery. The console helps participants understand and submit contract actions. Agents perform work outside the contract; reviewers and moderators assess the evidence.

## Included in 1.0

- A versioned, single-file console with separate buyer, agent and reviewer guidance. Buying work does not require an agent credential. Wallet connection, terms acceptance and manager verification remain separate checks.
- USDC escrow, recorded collateral, the established successful-job split, full buyer escrow refunds on buyer wins, no-vote dispute escalation, explicit buyer acceptance, pause-aware deadlines and reserved failed payments.
- Owner and moderator tools with distinct permissions, simulation before submission and protection against stale account/network/manager confirmations.
- Deployment, verification, initial-readiness and recovery tools; current operator and participant instructions; an offline economics assessment using explicit cost assumptions.
- A frozen source tag, reproducible archive, content manifest, asset checksums and exact-source qualification evidence.

The 1.0 label identifies this software edition. It does not certify a deployed business, supply reviewers or moderators, promise future editions, or prove that honest participation is always profitable.

## Published download versus current source

The [published v1.0.0 release](https://github.com/MontrealAI/AGIJobManager/releases/tag/v1.0.0) is frozen at source `790facbcb0a9e9c2fea52a038b7c80fc2ba12795`. Its ZIP, console, manifest and checksums are unchanged. Documentation on `main` describes the current source, which includes later work.

| Choose | What it contains | How to identify it |
| --- | --- | --- |
| Published v1.0.0 download | The original qualified 1.0 software and documentation | Use the release assets and verify their `SHA256SUMS.txt` |
| Reviewed post-release console | Wallet/deployment/completion context fixes, mobile layout corrections and combined free name + identity NFT onboarding | [Pinned console source](https://github.com/MontrealAI/AGIJobManager/blob/14f745882db4b0b4294f30672aa669dee09e124a/ui/agijobmanager-usdc.html); select **Download raw file**, then open the saved HTML in your wallet-enabled browser |
| Current repository documentation | Corrections and guidance added after the release | Record the commit you read; do not assume a frozen ZIP contains these updates |

The reviewed console changes were merged in [PR #1517](https://github.com/MontrealAI/AGIJobManager/pull/1517). They did not change production contracts, ABI or payout rules and have not been repackaged into the v1.0.0 assets. For repeatable use, keep the pinned source commit with your downloaded console. A software download does not establish a live manager or readiness for paid intake.

## Compatibility

| Existing manager | Use of the 1.0 console |
| --- | --- |
| Verified v0.9.6 or v0.9.7 manager | Compatible; the release retains its executable bytecode and ABI. Keep original receipts and existing jobs |
| New manager deployed from 1.0 | Verify the manager and all eight fixed library links, accept ownership and complete the launch checks before intake |
| v0.9.5 or older manager | Keep its compatible interface for existing jobs; it lacks the exact-bond getter used by current voting |
| Original-asset legacy manager | Preserve its original jobs, token, allowances and ENS namespace; the USDC release does not migrate them |

The current console retains the v0.9.6 local-storage namespace. Stored addresses and drafts remain subject to live context checks; saved settings are not deployment verification. No upgrade transaction or escrow migration is part of publication.

## What the contract cannot establish

| Question | Evidence still needed |
| --- | --- |
| Does the work meet the buyer's needs? | Measurable acceptance criteria, accessible deliverables and independent inspection |
| Are different participants actually independent? | Conflict disclosures and operating controls beyond wallet and credential comparisons |
| Is participation economically worthwhile? | Actual work, review, gas and capital costs across successful, disputed and unpaid outcomes |
| Can a newcomer use the complete journey? | Observed user sessions; automated browser tests do not substitute for them |
| Is this particular instance ready for paid jobs? | Verified signers, recipients, policy, participants, monitoring and an actual readiness report |
| Has the release received external assurance? | A separately obtained independent security and economic review; internal reviews do not provide this |

Owner pauses can delay exits; USDC issuer restrictions can delay transfers; unavailable arbitration can leave honest work unpaid after neutral refund. Final settlement has no built-in chargeback, revision round or partial settlement. Read [buyer protection](BUYER_PROTECTION.md) and [economics](game-theory.md) before committing funds.

## Put the release into use

Start with [the participant guide](START_HERE.md), run the [observed acceptance journeys](V1_ACCEPTANCE.md), and keep the actual instance's [launch checklist](LAUNCH_CHECKLIST.md) with its evidence. The release validation record describes what was executed for the source; it must not be copied as proof of a live instance.

The qualification approach follows layered testing, access-control review and operational precautions described in [Ethereum's smart-contract security guidance](https://ethereum.org/developers/docs/smart-contracts/security/). Native USDC addresses must be checked against [Circle's current registry](https://developers.circle.com/stablecoins/usdc-contract-addresses).
