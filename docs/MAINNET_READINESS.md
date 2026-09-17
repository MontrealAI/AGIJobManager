# v0.8.0 mainnet qualification

v0.8.0 is a software release for a fresh Ethereum deployment. It supplies no live manager, recipient wallets, owner-key verification or production signing authority. Automated qualification is evidence about the pinned source and tested scenarios; it is not an independent audit or a guarantee against every failure.

## Settlement

Jobs, escrow, bonds, rewards and refunds use native Circle USDC with six decimal places. On Ethereum the immutable token is `0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48`, checked against [Circle's address registry](https://developers.circle.com/stablecoins/usdc-contract-addresses).

| Successful 100 USDC job | Default amount |
| --- | ---: |
| Validators, first | 8 USDC |
| First wallet, 30% of original cost | 30 USDC |
| Second wallet, 10% of original cost | 10 USDC |
| Agent, remainder | 52 USDC |

The owner may set the validator budget to 1–60% for newly posted jobs. Existing jobs retain their posting-time percentage. Rounding and unused validator allocations go to the agent. Bonds and slashing are accounted separately. Refund outcomes do not pay the two successful-job wallet shares. Read the [complete payout specification](USDC_PAYOUT_SPLIT.md).

## Changes driven by review

- Intake starts paused in the constructor, eliminating the interval between deployment and a separate pause transaction.
- Job duration settings are bounded to 1–365 days in seconds, preventing owner configuration that can overflow lifecycle deadlines.
- Generic token rescue cannot call the manager itself or USDC. This preserves the boundary around internal completion-NFT minting and reserved funds.
- Deployment checks bind the selected network to its chain ID, validate native USDC and issuer restrictions, enforce compiler and bytecode limits, compare linked runtime code, preserve partial deployment receipts, and report incomplete explorer verification as failure.
- A read-only deployment check verifies the actual instance before opening intake; ownership acceptance remains explicit.
- Transaction reviews bind the connected account, network and manager through approvals and submission. Changed contexts require a new review. Failed receipts cannot be reported as successful.
- Qualification includes contract regressions, issuer restrictions, bonds/disputes, exact transfer ordering, fuzzing, concurrent-job invariants, deployment rejection scenarios, browser tests and static-analysis triage.

## Reproduce qualification

Use Node 22.23.2 and the committed lockfiles. Root Truffle/Ganache tests require disposable local accounts only; see [dependency scope](DEPENDENCY_SECURITY.md).

```bash
npm ci
npm test
node scripts/release/verify-usdc-ui.mjs
npm run test:ui
cd hardhat
npm ci
npm run compile
npm run test:preflight
npm run test:deployment
npm run test:mainnet-fork
```

The qualified fork fixture pins Ethereum block **25,997,388**, hash `0x1495b5decf70b7757b60b8d4ba10d14a7cdb4512f55c4ae5400d8a97b9deedf9`, and checks USDC implementation `0x43506849D7C04F9138D1A2050bbF3A0c054402dd` plus its runtime hash. Eight cases cover paused launch, exact default-bond settlement and real issuer pause/blocklist rollback and recovery.

The fork runner exposes only the local Hardhat network. It reads a pinned finalized Ethereum block and executes every transaction on that local fork. It never broadcasts transactions to Ethereum, does not use production private keys and fails if the remote state is unavailable. Fork evidence checks a historical state; USDC implementation and issuer configuration must be rechecked before an actual launch.

```bash
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

Use Foundry 1.7.1 and Slither 0.10.4. The extended static-analysis gate preserves raw findings and verifies a reviewed baseline instead of excluding whole detector classes. Consult the linked CI logs and release validation document for exact source-specific results.

## An actual high-stakes launch

Before committing significant funds, obtain independent review of the final source and operational setup, rehearse with the actual owner/signing arrangement on Sepolia, and provide the real recipient addresses. These activities are not completed by publishing a GitHub release.

Follow the [Hardhat guide](../hardhat/README.md), complete source verification and two-step ownership acceptance, and run the read-only readiness command while intake remains paused. Reconcile USDC, both wallets, linked code, policy settings and all reserve counters against the deployment receipt. Open intake only after these instance-specific checks pass; use a deliberately limited first job before increasing exposure.

## Operational limits

- This is not a proxy. Code changes require a new deployment; supported owner settings remain available under their on-chain guards.
- The owner and moderators remain trusted authorities. A compromised owner can misuse eligibility, pause or dispute powers even though reserved funds cannot be withdrawn as surplus.
- Circle may pause USDC, block addresses or upgrade its implementation. A restricted recipient can prevent the entire settlement. Tests establish atomic rollback, not a way around issuer restrictions. Existing reserved jobs cannot be redirected by rotating the two wallets.
- Validators can collude or misjudge off-chain work. Bonds and tests do not prove the truth of a submitted deliverable.
- ENS and metadata are external dependencies. Optional job-page failures are bounded; identity availability and correct operational configuration still matter.
- The manager remains close to Ethereum's runtime size limit. Preserve the qualified compiler settings and repeat bytecode/deployment checks after every source or compiler change.
- UI/root production dependency audits are clean at qualification; the deployment toolchain retains low-severity advisories. Legacy local test tooling retains higher-severity advisories and must never receive production keys.

The [deploy-day runbook](DEPLOY_DAY_RUNBOOK.md), [owner controls](OWNER_CONTROLS.md) and [incident response](OPERATIONS/INCIDENT_RESPONSE.md) describe the operational steps.
