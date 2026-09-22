# AGIJobManager release scope

**Current edition: v1.6.1.** Use [release identity and deployment commands](RELEASE_GUIDE.md), the matching archive and its exact-source evidence. AGIJobManager coordinates USDC-funded jobs, bonded review and buyer recovery; work and evidence evaluation occur outside the contract.

## Included in this edition

- Public source and a versioned USDC console with participant, owner and recovery guidance.
- The preserved contract build, eight library links, USDC accounting, buyer protections and reserved payment claims.
- Hardhat setup, explicit read-only plans, guarded deployment, source verification, transaction journals, recovery and instance-readiness checks.
- Lifecycle economics, signed action-bound qualification, pre-funding offer/capacity checks and canonical state/closure observations.
- Reproducible release assets, source qualification, per-file manifests and asset checksums.

The public archive contains no private Fleet/Agent/Node application, production wallet, live deployment, issuer service or production signing authority. Private packages have separate versions, guides and commissioning evidence. A manual console transaction does not enforce off-chain economic qualification.

## Published download versus current source

**v1.6.1 synchronizes active documentation, release metadata and deployment entrypoints.** It corrects the previously stale deployment-registry version, old download links, incomplete edition history and conflicting current-guide headings. A generated release/command guide and CI checks keep package/lock/registry versions, active headings, downloads and executable command names aligned. Deployment implementation, Solidity, payouts and dependency resolutions are unchanged.

Use an immutable tag and matching COMPLETE archive. Its outer `VALIDATION.md`, `SOURCE_CI.json` and `RELEASE_MANIFEST.json` identify the qualified source and publication evidence. Main may contain later work; never combine its scripts with an older release's instructions or attestations. Current guides apply to their checkout. Historical releases, dated qualification records and legal notices retain their original versions.

| Edition | Change introduced |
| --- | --- |
| [v1.6.1](https://github.com/MontrealAI/AGIJobManager/releases/tag/v1.8.0) | Documentation/release alignment, current command map, corrected download routes and automated drift checks |
| [v1.6.0](https://github.com/MontrealAI/AGIJobManager/releases/tag/v1.6.0) | Schema 3 employer pre-funding qualification, capacity/value evidence, canonical posting observations and closure receipts; browser persistence repair |
| [v1.5.0](https://github.com/MontrealAI/AGIJobManager/releases/tag/v1.5.0) | Schema 2 exact action/vote/delivery binding, fixed reviewer ballots, bounded preparation policy and valid job-zero handling |
| [v1.4.0](https://github.com/MontrealAI/AGIJobManager/releases/tag/v1.4.0) | Lifecycle stresses, signed qualification envelopes, role-specific margins and separate capital/cost/job/gas limits |
| [v1.3.0](https://github.com/MontrealAI/AGIJobManager/releases/tag/v1.3.0) | Participant margin and loss screening against explicit scenario assumptions |
| [v1.2.1](https://github.com/MontrealAI/AGIJobManager/releases/tag/v1.2.1) | Canonical settlement snapshots, expected-token validation and RPC freshness checks |
| [v1.2.0](https://github.com/MontrealAI/AGIJobManager/releases/tag/v1.2.0) | Read-only settlement visibility, reserve reconciliation and recovery guidance |
| [v1.1.0](https://github.com/MontrealAI/AGIJobManager/releases/tag/v1.1.0) | Read-only deployment defaults and corrected operator guidance |
| [v1.0.5](https://github.com/MontrealAI/AGIJobManager/releases/tag/v1.0.5) | Privacy rules, explicit draft storage and public-content safeguards |
| [v1.0.4](https://github.com/MontrealAI/AGIJobManager/releases/tag/v1.0.4) | Publisher/operator notices and legal/privacy guidance |
| [v1.0.3](https://github.com/MontrealAI/AGIJobManager/releases/tag/v1.0.3) | NFT admission disabled on fresh construction; owner opt-in preserved |
| [v1.0.2](https://github.com/MontrealAI/AGIJobManager/releases/tag/v1.0.2) | Non-overwriting private setup, offline profile checks and configuration reference |
| [v1.0.1](https://github.com/MontrealAI/AGIJobManager/releases/tag/v1.0.1) | Fresh ENS job namespaces and participant-console improvements |
| [v1.0.0](https://github.com/MontrealAI/AGIJobManager/releases/tag/v1.0.0) | Frozen 1.0 source at `790facbcb0a9e9c2fea52a038b7c80fc2ba12795` |

## Compatibility

| Existing manager | Use with the current console |
| --- | --- |
| Verified v0.9.6 or v0.9.7 manager | Compatible ABI/runtime; construction defaults differ. Preserve original receipts, settings and job policies |
| Verified manager from the preserved v1.0.3 contract build or subsequent compatible release | No redeployment needed for this documentation patch; verify the actual instance and all eight links |
| v0.9.5 or older manager | Keep its compatible interface for existing jobs; it lacks the exact-bond getter used by current voting |
| Original-asset legacy manager | Preserve original jobs, token, allowances and ENS namespace; the USDC release does not migrate them |

The current console retains its historical saved-context namespace and rechecks wallet, chain and manager. Saved data is not deployment verification or legal acceptance. Publishing a new software edition neither upgrades bytecode nor imports escrow. The MIT license and earlier agreements are unchanged.

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

## Current admission primitives

The public tools cover explicit lifecycle stress cases, operator-owned economic limits, signed evidence attestations, and current canonical two-RPC terms. They do not implement an autonomous signing service or certify market inputs. See [qualified admission](OPERATIONS/QUALIFIED_ADMISSION.md) and [pre-funding and closure scope](qualification/V160_PREFUNDING.md).
