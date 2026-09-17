# v0.9.1 — Contract hardening and audited toolchains

v0.9.1 fixes contract validation and settlement-state issues, removes the vulnerable legacy test/deployment dependency trees, and makes the release checks stricter.

## Changes

- Reject malformed ENS address responses and unexpected NameWrapper node returns.
- Require canonical ERC-165/ERC-721 responses, including rejection of the invalid interface.
- Complete all validator reputation updates before any validator token transfer; preserve atomic rollback, payment order and amounts.
- Emit events for owner changes to maximum job payout and job-duration limits.
- Replace Truffle/Ganache and Hardhat 2 with Hardhat 3 and ethers 6. Preserve and extend the regression scenarios using a local EVM.
- Qualify Solidity 0.8.37 with the pinned via-IR/Shanghai profile. Exact, hash-checked OpenZeppelin compiler-compatibility transformations remain auditable and reproducible.
- Verify exact Etherscan source, compiler settings, constructor arguments, ABI and linked libraries; reject incomplete or misleading responses.
- Require full root, deployment and UI dependency audits at every severity, strict compiler/lint checks, actual deployment limits and all-detector static-analysis review.
- Update deployment instructions, recovery guidance, generated references and standalone UI artifacts.

## USDC settlement

The default successful-job split remains **8% validators → 30% first wallet → 10% second wallet → 52% agent**. Wallet percentages use the original job cost. Bonds are separate; unused validator allocation and rounding go to the agent. Owner changes to the validator rate apply to newly posted jobs.

## Deployment and compatibility

**A fresh deployment is required to receive the production contract fixes.** This release does not upgrade existing contracts, migrate funds, select wallets, deploy to mainnet or activate intake. Existing jobs and approvals remain on their original contracts.

All eight production components deploy locally with Ethereum code-size enforcement. The manager runtime is **24,409 bytes**, with only **167 bytes** of EIP-170 headroom. Repeat size and deployment qualification after any source/compiler change. Managers start paused; verify source, complete ownership acceptance and run the instance-readiness checks before activation.

## Evidence and remaining limitations

The publication gate requires successful contract, UI, documentation, security and actual-USDC fork workflows for the exact frozen source. Full dependency audits report zero known vulnerabilities at qualification. See [validation](https://github.com/MontrealAI/AGIJobManager/blob/main/docs/releases/v0.9.1/VALIDATION.md) for source identity, test counts and CI links.

**This is not a zero-findings or warning-free installation claim.** The original 50 distinct mandatory Slither findings are reduced to 37 reviewed observations. The new complete scan covers all 102 enabled detectors and retains 116 observations: 0 high, 7 medium, 36 low, 71 informational and 2 optimization. Every finding has an explicit review rationale; unexpected drift fails the gate. Intentional lint exceptions and remaining UI dependency deprecation notices are disclosed in the source security notes.

Automated qualification and internal review are not an independent audit or certification of a live deployment. The fork tests use pinned historical USDC state. Owner/moderator authority, validator judgment and issuer restrictions remain operational dependencies.

## Downloads

- **AGIJobManager-v0.9.1-COMPLETE.zip** — pinned source, USDC console, user/deployment guidance and release evidence.
- **agijobmanager-usdc.html** — standalone USDC operator console.
- **RELEASE_MANIFEST.json** — source identity and per-file SHA-256 inventory.
- **SHA256SUMS.txt** — download integrity checks.

The publisher verifies the exact source CI, reproduces the archive twice and checks all four uploaded asset digests before publication. Prior tags and published releases are preserved.
