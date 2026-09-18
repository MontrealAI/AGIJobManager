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

**Post-v1.0.5 deployment maintenance in this checkout:** manager and optional ENS helper scripts default to read-only when `DRY_RUN` is missing or empty. Broadcasts require an explicit false value (documented as `DRY_RUN=0`) plus the existing signer, verification and mainnet confirmation gates. The offline check reports the selected mode. Operator guides are corrected for the disabled NFT default, five initial reserve counters and deployment-specific ENS names. These changes do not modify published v1.0.5 tags/assets, legal terms, Solidity, ABI, bytecode or deployed contracts. Pin the reviewed commit and use its matching guide and CI evidence; v1.0.5 release evidence covers its frozen source only.

The v1.0.5 edition strengthens privacy rules and user responsibilities, adds fresh public-content reviews, and reduces saved browser content and credential exposure. It retains the v1.0.4 publisher/operator boundaries and fresh acknowledgement safeguards. It preserves v1.0.3 contract behavior and the v1.0.1 ENS naming policy. Existing instances, jobs, agreements and prior published assets do not change.

| Edition | Contents |
| --- | --- |
| [v1.0.5](https://github.com/MontrealAI/AGIJobManager/releases/tag/v1.0.5) | Public-content rules, lawful user responsibility, private incident handling, explicit draft storage and reviewed credential-safe uploads; contract bytecode unchanged |
| [v1.0.4](https://github.com/MontrealAI/AGIJobManager/releases/tag/v1.0.4) | MIT-compatible publisher and independent-owner notices, deployment-specific terms template, legal/privacy guidance, synchronized source notices and fresh console acknowledgement |
| [v1.0.3](https://github.com/MontrealAI/AGIJobManager/releases/tag/v1.0.3) | Disabled NFT-admission default on fresh construction, owner opt-in, aligned deployment/readiness setup and regression coverage |
| [v1.0.2](https://github.com/MontrealAI/AGIJobManager/releases/tag/v1.0.2) | Non-overwriting private configuration setup, offline profile validation, explicit Hardhat environment, complete configuration reference and refreshed operator guides |
| [v1.0.1](https://github.com/MontrealAI/AGIJobManager/releases/tag/v1.0.1) | Automatic fresh ENS namespace and `job-` prefix, same-manager preservation, wallet/deployment/completion context fixes, mobile corrections, combined free name + identity NFT onboarding, and the historical Genesis simulation |
| [v1.0.0](https://github.com/MontrealAI/AGIJobManager/releases/tag/v1.0.0) | Original frozen 1.0 software at `790facbcb0a9e9c2fea52a038b7c80fc2ba12795` |

Use the selected edition's assets and `SHA256SUMS.txt`. Its manifest identifies the frozen source and qualification evidence. v1.0.3 changes the manager constructor default; its ABI, deployed runtime, library code and payout rules are preserved. The [new ENS naming policy](ENS_DEPLOYMENT_NAMESPACES.md) applies to fresh deployments through the supported tooling; a console update keeps existing jobs and namespaces on their original manager. Software publication does not establish a live manager or readiness for paid intake.

## Compatibility

| Existing manager | Use of the 1.0 console |
| --- | --- |
| Verified v0.9.6 or v0.9.7 manager | Compatible ABI and deployed runtime; construction defaults differ. Keep original receipts, on-chain settings and existing job policies |
| New manager deployed from 1.0 | Verify the manager and all eight fixed library links, accept ownership and complete the launch checks before intake |
| v0.9.5 or older manager | Keep its compatible interface for existing jobs; it lacks the exact-bond getter used by current voting |
| Original-asset legacy manager | Preserve its original jobs, token, allowances and ENS namespace; the USDC release does not migrate them |

The current console retains the v0.9.6 configuration/draft namespace but never restores acknowledgement from saved state. Stored addresses and drafts remain subject to live context checks; saved settings are not deployment verification or legal acceptance. No upgrade transaction or escrow migration is part of publication. The MIT license is unchanged; new notices are not retroactive agreements or extra software-use conditions.

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
