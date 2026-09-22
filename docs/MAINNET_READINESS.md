# v1.5.0 mainnet qualification

v1.5.0 is a software release for verified v0.9.6-compatible managers and new Ethereum deployments. It supplies no live manager, recipient wallets, owner-key verification or production signing authority. Automated qualification is evidence about the pinned source and tested scenarios; it is not an independent audit or a guarantee against every failure.

The project already has a legacy mainnet manager with outstanding original-asset obligations. The [USDC cutover qualification](qualification/USDC_CUTOVER.md) records that live state, the ENS resolver correction first included in v0.9.2 and retained in v1.1.0, and a fork rehearsal preserving existing jobs. Software qualification and live-instance approval remain separate.

The [v1.5.0 qualified admission tools](OPERATIONS/QUALIFIED_ADMISSION.md) add lifecycle modeling, signed attestations and canonical state reads. A result within supplied limits does not establish live admission readiness or guaranteed participant profitability. Canonical settlement reporting from v1.2.1 remains available.

## Settlement

Jobs, escrow, bonds, rewards and refunds use native Circle USDC with six decimal places. On Ethereum the immutable token is `0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48`, checked against [Circle's address registry](https://developers.circle.com/stablecoins/usdc-contract-addresses).

| Successful 100 USDC job | Default amount |
| --- | ---: |
| Validators, first | 8 USDC |
| First wallet, 30% of original cost | 30 USDC |
| Second wallet, 10% of original cost | 10 USDC |
| Agent, remainder | 52 USDC |

The owner may set the validator budget to 1–60% for newly posted jobs. Existing jobs retain their posting-time percentage. Rounding and unused validator allocations go to the agent. Bonds and slashing are accounted separately. Refund outcomes do not pay the two successful-job wallet shares. Read the [complete payout specification](USDC_PAYOUT_SPLIT.md).

## Retained contract safeguards and qualification

- Intake starts paused in the constructor, eliminating the interval between deployment and a separate pause transaction.
- Job duration settings are bounded to 1–365 days in seconds, preventing owner configuration that can overflow lifecycle deadlines.
- Generic token rescue cannot call the manager itself or USDC. This preserves the boundary around internal completion-NFT minting and reserved funds.
- Deployment checks bind the selected network to its chain ID, validate native USDC and issuer restrictions, enforce compiler and bytecode limits, compare linked runtime code, preserve partial deployment receipts, and report incomplete explorer verification as failure.
- A read-only deployment check verifies the actual instance before opening intake; ownership acceptance remains explicit.
- Transaction reviews bind the connected account, network and manager through approvals and submission. Changed contexts require a new review. Failed receipts cannot be reported as successful.
- Qualification includes contract regressions, issuer restrictions, bonds/disputes, exact transfer ordering, fuzzing, concurrent-job invariants, deployment rejection scenarios, browser tests and static-analysis triage.

## Version 1.0 qualification scope

Version 1.1.0 adds read-only deployment defaults and corrected operator guidance while retaining v1.0.5 privacy notices, public-content review, credential handling and browser storage. It preserves v1.0.3 ABI, creation/runtime bytecode and disabled NFT default. Existing managers keep their settings, jobs and agreements. See [release scope](V1_RELEASE_SCOPE.md), the [internal contract review](qualification/V1_CONTRACT_REVIEW.md), [v1.0.3 default review](qualification/V103_NFT_DEFAULT.md), [v1.0.4 notice review](qualification/V104_OPERATOR_NOTICES.md), [v1.0.5 privacy review](qualification/V105_PRIVACY.md), [acceptance protocol](V1_ACCEPTANCE.md) and [launch checklist](LAUNCH_CHECKLIST.md).

The earlier [v0.9.7 operating review](qualification/OPERATIONS_V097.md) and [v0.9.6 exact-bond review](qualification/BUYER_ECONOMICS_FOLLOWUP.md) remain historical evidence. Full buyer escrow refunds, no-vote dispute escalation, explicit acceptance, full review, credential/controller conflict checks, pause-aware deadlines, neutral timeout and reserved payment claims are preserved. Final source CI and release validation establish the executed qualification scope; independent audit, real-user studies and live-instance readiness are separate evidence.

## Reproduce qualification

Use Node 22.23.2 and the committed lockfiles. Install the root and Hardhat workspaces before running the contract tests; all local tests use disposable accounts. See [dependency scope](DEPENDENCY_SECURITY.md).

```bash
npm ci
npm --prefix hardhat ci
npm test
node scripts/ui/verify-usdc-console.mjs
npx playwright install --with-deps chromium
npm run test:ui:usdc
npm run test:ui
cd hardhat
npm ci
npm run compile
npm run test:preflight
npm run test:deployment
npm run test:mainnet-fork
CUTOVER_REPORT=../build/qualification/mainnet-cutover.json npm run test:cutover
```

The commands above target current source. For the frozen v1.0.0 tag, use its recorded console verifier and qualification commands; it predates the primary-console browser runner. [Release versus source](V1_RELEASE_SCOPE.md#published-download-versus-current-source) identifies the difference. Browser wallet/RPC responses are mocked, with no signing or broadcast.

The qualified fork fixture pins Ethereum block **25,997,388**, hash `0x1495b5decf70b7757b60b8d4ba10d14a7cdb4512f55c4ae5400d8a97b9deedf9`, and checks USDC implementation `0x43506849D7C04F9138D1A2050bbF3A0c054402dd` plus its runtime hash. Eight cases cover paused launch, exact default-bond settlement and real issuer pause/blocklist protected claims and recovery.

The separate cutover fixture pins block **25,998,952**, hash `0xac9075441aff899351bf4ca9abf5be0edc4494b69a1c7543b389fd8cacaa159a`. Its 23 scenarios exercise the actual mainnet ENS contracts, all four participant membership roots and explicit exceptions, separate ownership paths, both NFT modes with unchanged ENS authorization and USDC settlement, further recovery cases, the preserved legacy inventory and the original-asset exit for job 11. See the [source-bound report](qualification/mainnet-cutover.json).

The fork runner exposes only the local Hardhat network. It reads a pinned finalized Ethereum block and executes every transaction on that local fork. It never broadcasts transactions to Ethereum, does not use production private keys and fails if the remote state is unavailable. Fork evidence checks a historical state; USDC implementation and issuer configuration must be rechecked before an actual launch.

```bash
cd ..
FOUNDRY_PROFILE=ci forge build --deny warnings
FOUNDRY_PROFILE=ci forge test
npm run slither
npm run slither:extended
cd ui
npm ci
npm run lint
npm run typecheck
npm test
npm run test:e2e
npm run test:a11y
npm run test:headers
```

Use Foundry 1.7.1 and Slither 0.11.6. The extended static-analysis gate preserves raw findings and verifies a reviewed baseline instead of excluding whole detector classes. Consult the linked CI logs and release validation document for exact source-specific results.

## An actual high-stakes launch

Before committing significant funds, obtain independent review of the final source and operational setup, rehearse with the actual owner/signing arrangement on Sepolia, and provide the real recipient addresses. These activities are not completed by publishing a GitHub release.

Complete applicable legal review for the actual operator, owner powers, fee beneficiaries, service scope and jurisdictions. Publish the [operator notice](LEGAL/OPERATOR_NOTICE_TEMPLATE.md) and meet required terms, privacy and language arrangements. A technical readiness report explicitly leaves these matters unassessed; open-source publication and disclaimers do not guarantee regulatory immunity.

Follow the [Hardhat guide](../hardhat/README.md), complete source verification and two-step ownership acceptance, and run the read-only readiness command while intake remains paused. Reconcile USDC, both wallets, linked code, policy settings and all reserve counters against the deployment receipt. Open intake only after these instance-specific checks pass; use a deliberately limited first job before increasing exposure.

## Operational limits

- This is not a proxy. Code changes require a new deployment; supported owner settings remain available under their on-chain guards.
- The owner and moderators remain trusted authorities. A compromised owner can misuse eligibility, pause or dispute powers even though reserved funds cannot be withdrawn as surplus.
- Circle may pause USDC, block addresses or upgrade its implementation. Failed outgoing transfers become protected claims; tests establish reserve conservation and same-beneficiary retries. Claims and existing jobs cannot be redirected by rotating wallets.
- Validators can collude or misjudge off-chain work. The employer and assigned agent cannot vote on their own job; duplicate ENS credentials and recorded controllers are rejected. Distinct addresses or ENS names still do not establish independent people or rule out hidden common control. Configure and monitor eligibility accordingly; bonds and tests do not prove the truth of a deliverable.
- ENS and metadata are external dependencies. Optional job-page failures are bounded; identity availability and correct operational configuration still matter.
- The qualified manager runtime is 24,359 bytes: 217 bytes below Ethereum's 24,576-byte limit. Preserve the qualified compiler settings and repeat bytecode/deployment checks after every source or compiler change.
- CI audits the complete root, deployment and UI dependency trees and rejects advisories at every severity. Repeat those checks against the current registry before deployment; a clean advisory database result does not prove absence of unknown vulnerabilities.

The [deploy-day runbook](DEPLOY_DAY_RUNBOOK.md), [owner controls](OWNER_CONTROLS.md) and [incident response](OPERATIONS/INCIDENT_RESPONSE.md) describe the operational steps.
