# v0.9.0 — Safer deployment recovery and USDC operations

v0.9.0 closes concrete deployment-recovery, transaction-review and documentation gaps after v0.8.0. Production Solidity, compiler settings and settlement economics are unchanged: jobs are funded in native Circle USDC; successful settlement pays eligible validators first, then **30% and 10% of the original job cost** to the configured wallets, then **the entire remainder to the agent**. With the default 8% validator budget, a 100 USDC job pays **8 / 30 / 10 / 52 USDC**. Bonds are separate.

## Downloads

- **AGIJobManager-v0.9.0-COMPLETE.zip** — pinned source, standalone USDC console, participant and operator guidance, validation evidence, manifest and release tooling.
- **agijobmanager-usdc.html** — the versioned standalone console.
- **RELEASE_MANIFEST.json** and **SHA256SUMS.txt** — payload and download integrity checks.

## What changed

- **Recover interrupted deployments safely.** Strict flags and receipt checks reject ambiguous inputs or outcomes. Source verification precedes owner handover. The journal now checkpoints linked library addresses before broadcasting the manager, so a mined deployment remains recoverable after a confirmation or runtime-read failure. Re-verification reads chain state and writes a separate report without sending blockchain transactions.
- **Review the transaction that will actually be sent.** Wallet, network, manager and reviewed identity parameters stay bound through asynchronous preparation, approvals and submission. Overlapping reviews are rejected; keyboard focus and cancellation work consistently. The React interface checks the fresh simulation request and polls receipts on the intended chain.
- **Use clearer operational guidance.** A role-based start page, participant walkthrough, owner runbook, incident response and verification/recovery instructions replace retired operational guidance. No-vote completion, separate bond movements, pause controls and issuer restrictions are explained explicitly.
- **Close the UI development-dependency gap.** The qualified Vitest/Vite update removes known advisories from the full UI dependency tree; CI now audits that full scope. Production dependency versions are unchanged.
- **Strengthen security evidence.** Slither 0.11.6 expands detector coverage while retaining all 50 individually reviewed findings. The verifier rejects ambiguous or malformed evidence. New bond-snapshot and terminal-drain assertions strengthen lifecycle qualification.

## Qualification and provenance

All five required workflows must pass for the frozen application source: contract CI, UI CI, documentation integrity, security verification and actual-USDC local mainnet-fork qualification. The package records their source identity and run links in `VALIDATION.md` and `SOURCE_CI.json`. The publisher rechecks that evidence, verifies a reproducible archive and compares uploaded asset digests before publishing.

Qualification covers the full contract regression shards, UI unit/browser/accessibility/header suites, deployment/preflight/recovery cases, Foundry fuzz and stateful invariants, malformed-evidence regressions and eight actual-Circle-USDC fork scenarios. Read `VALIDATION.md` for measured results and the precise scope.

The full UI and root production dependency audits report zero known findings at qualification. Hardhat retains 14 low findings. The isolated legacy Truffle/Ganache test tree retains documented high/critical development advisories; it is not suitable for production keys. Extended static analysis retains 50 reviewed findings, including analyzer-reported high/medium findings, with explicit rationale and evidence rather than a zero-findings claim.

## Deployment and compatibility

**No live contract is deployed, upgraded or activated by this release.** A new USDC instance needs its two recipient addresses, intended owner, source verification, two-step ownership acceptance and read-only readiness checks. New managers start paused. Production contracts match v0.8.0; this release does not force an otherwise verified v0.8.0 USDC instance to redeploy. Migration from legacy token managers still requires a fresh USDC deployment. Historical deployment receipts are preserved and do not identify a running v0.9.0 marketplace.

Owner settings remain available within their guards. Recipient rotation requires paused intake and zero reserved funds. The implementation has no proxy upgrade path. USDC issuer restrictions, owner/moderator powers, validator judgment, gas and external identity/metadata services remain operational dependencies.

Automated qualification is not an independent security audit or a guarantee of flawless behavior. Independent source and operational review, the actual signer configuration and a testnet rehearsal remain prerequisites for significant live exposure.

Start with `START_HERE.md`, then `source/docs/START_HERE.md` or `source/hardhat/README.md` for your role.
