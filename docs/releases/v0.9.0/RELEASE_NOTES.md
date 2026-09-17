# v0.9.0 — USDC settlement and safer operations

Jobs are posted, escrowed and paid in native Circle USDC. Successful settlement pays validators first, then **30% and 10% of the original job cost** to the two configured wallets, then **the remaining USDC to the agent**. The default 100 USDC allocation is **8 / 30 / 10 / 52**. Bonds and slashing are separate.

## Downloads

- **AGIJobManager-v0.9.0-COMPLETE.zip** — pinned source, USDC console, deployment/recovery tools, tests, documentation and integrity evidence.
- **agijobmanager-usdc.html** — versioned standalone console.
- **RELEASE_MANIFEST.json** and **SHA256SUMS.txt** — archive payload and uploaded asset checksums.

## What improved

- **Deployment and recovery:** strict control flags prevent ambiguous dry-run input from becoming a broadcast. Verification rejects misleading error text and disabled explorer configuration. Receipt checks validate success, transaction/block hashes and created addresses. Source verification completes before ownership is proposed. Optional ENS deployment preserves partial journals and verifies before locking or handing over authority.
- **Read-only instance checks:** readiness validates the receipt, intended identity configuration and a consistent chain block. Explicit reviewed identity overrides are recorded by hash. A separate recovery command reconciles existing creation transactions and exact linked runtime, retries source verification, and writes a new recovered receipt without blockchain transactions or overwriting the original.
- **Transaction review:** asynchronous preparation cannot silently change the reviewed context. Reviewed labels/recipients stay fixed, overlapping dialogs are rejected, terminal action facts are refreshed, cached failed simulations cannot be submitted, and returned requests must match reviewed calldata/target/value. Receipt polling stays on the intended chain. Review dialogs support keyboard focus and cancellation.
- **Security tooling:** the complete UI dependency audit is now clear, including development tools. Vitest/Vite are updated without changing production dependency versions. Slither 0.11.6 adds detector coverage while preserving all previously reviewed findings. Strict evidence parsing rejects duplicate keys, malformed reports and invalid review metadata.
- **Assurance and documentation:** stronger bond-snapshot and terminal-drain invariants, a clear participant entry guide, corrected pause/incident procedures, current owner handover/recovery instructions and removal of misleading retired deployment/API guidance.

## Qualified scope

The production Solidity, compiler profile and settlement economics are unchanged from v0.8.0. Existing safeguards include paused construction, bounded duration settings, two-step ownership, fixed USDC and guarded recipient rotation.

Publication requires successful contract, UI, security, documentation and actual-USDC mainnet-fork workflows for the exact source commit. Local qualification includes **171 UI unit tests**, **35 standalone-console checks**, **58 deployment preflight/readiness/recovery cases**, **4 actual local deployments**, **27 Foundry tests**, and **9 evidence-parser cases covering 27 rejection scenarios**. The complete contract suite and browser suites remain required CI gates. See `VALIDATION.md` and the linked run logs.

The USDC fork remains pinned to Ethereum block 25,997,388 and checks the actual Circle implementation/code hash. Fork transactions stay local. The qualified manager runtime remains 24,537 bytes.

Extended Slither retains **50 distinct reviewed findings**, including analyzer-reported high/medium findings, with individual rationale and code/test evidence. Full UI and root production dependency audits are clear at qualification; Hardhat retains 14 low advisories. Legacy disposable Truffle/Ganache test dependencies retain documented high/critical development advisories and must never receive production keys.

## Deployment boundary

**No live contract was deployed or upgraded.** No recipient wallets or production signing setup are supplied. Owner/moderator authority, validator judgment, USDC issuer restrictions and external identity/metadata systems remain operational dependencies. No-vote finalization is a liveness fallback, not independent proof of work quality.

This is an internally tested and reviewed software release, not an independent audit or a guarantee that every failure scenario has been exhausted. Before high-stakes activation, complete independent review, the actual signer/participant rehearsal and the instance-specific readiness checks. UI checks cannot freeze blockchain state during transaction inclusion.

Start with `START_HERE.md`, `source/docs/START_HERE.md` and `source/hardhat/README.md`.
