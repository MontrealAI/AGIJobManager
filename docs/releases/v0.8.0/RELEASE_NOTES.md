# v0.8.0 — USDC settlement and mainnet qualification

Jobs are posted, escrowed and paid in native Circle USDC. Successful settlement pays validators first, then **30% and 10% of the original job cost** to the two configured wallets, then **all remaining USDC to the agent**. With the default 8% validator budget, a 100 USDC job pays **8 / 30 / 10 / 52 USDC**. Bonds and slashing are separate; rounding and unallocated validator rewards go to the agent.

## Downloads

- **AGIJobManager-v0.8.0-COMPLETE.zip** — pinned source, standalone USDC console, deployment guidance, tests, review evidence, manifest and release tooling.
- **agijobmanager-usdc.html** — versioned standalone console.
- **RELEASE_MANIFEST.json** and **SHA256SUMS.txt** — payload and asset integrity checks.

## What changed

- **Paused from deployment:** the constructor closes intake before the contract becomes callable; the accepted owner opens it only after setup and verification.
- **Safer owner settings:** job duration is bounded to 1–365 days; generic token rescue rejects the manager itself and USDC. Existing recipient rotation still requires paused intake and zero outstanding escrow/bonds. Ownership remains a two-step handover.
- **Deployment checks:** chain/name binding, canonical operational USDC, recipient and metadata validation, exact compiler/artifact and linked-runtime matching, Ethereum bytecode limits, incremental transaction journals and unsuccessful exit on incomplete source verification. A keyless, block-pinned checker validates the actual instance before activation.
- **Safer transaction review:** the UI pins account/network/manager through approvals and submission, simulates writes, recognizes failed receipts, uses exact approvals, shows the payout split and recipient addresses, and rejects changed posting terms before sending.
- **Stronger qualification:** actual Circle USDC on a pinned local Ethereum fork; expanded bonded failure/recovery tests; full-lifecycle fuzzing and concurrent-job invariants; deployment failure scenarios; and a static-analysis gate that retains individually reviewed findings instead of silencing detector families.

## Evidence

Publication requires five successful CI gates for the exact application commit: contracts, UI, documentation, security verification and actual-USDC mainnet-fork qualification. The release publisher rechecks each run before creating the tag.

Local qualification includes 26 Foundry tests (256 samples per fuzz test and 16,384 invariant calls), 8 real-USDC local-fork scenarios, 20 preflight tests, 4 actual deployment tests, 153 UI unit tests, and 35 standalone-console checks. CI also runs the complete contract regressions and browser/navigation/accessibility/header suites. See `VALIDATION.md` for source-specific evidence.

The fork pins Ethereum block 25,997,388 and verifies Circle's implementation and code hash. All fork transactions remain local. Runtime is 24,537 bytes under the qualified compiler profile.

The extended static analysis retains 50 distinct reviewed findings, including analyzer-reported high/medium findings explained in the source-bound triage. They are not omitted or described as zero findings. UI/root production audits are clean at qualification; Hardhat retains 14 low advisories. Legacy local Truffle/Ganache development dependencies retain higher-severity advisories and must not receive production keys.

## Deployment and limits

**No live contract was deployed or upgraded.** A fresh deployment, two reviewed recipient addresses, ownership acceptance and the read-only readiness checks are required. Code is non-upgradeable; supported owner configuration remains available under its guards.

Automated qualification is not an independent security audit or certification for an arbitrary high-stakes live instance. Independent source/operational review, the actual signer setup and a testnet rehearsal remain necessary before significant exposure. USDC issuer restrictions, owner/moderator authority, validator judgment, gas and external identity/metadata dependencies remain operational risks. UI checks cannot freeze chain state during transaction inclusion.

Start with `START_HERE.md`, `source/hardhat/README.md` and `source/docs/MAINNET_READINESS.md`.
