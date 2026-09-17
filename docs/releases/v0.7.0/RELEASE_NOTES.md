# v0.7.0 — USDC settlement and guarded owner controls

Jobs are posted and paid in native Circle USDC. Successful completion pays the original escrowed job cost in one atomic transaction:

| Order | Recipient | Share | Example: 100 USDC |
| --- | --- | --- | --- |
| 1 | Correct-side validators | 8% default | 8 USDC |
| 2 | First settlement wallet | 30% | 30 USDC |
| 3 | Second settlement wallet | 10% | 10 USDC |
| 4 | Assigned agent | Remaining balance | 52 USDC |

The 30% and 10% shares are calculated from the **original job cost** and are included in the employer's escrow. The agent receives rounding and any unallocated validator budget. Bond returns and slashing are separate. Cancellations, expiry and employer-win refunds do not pay the wallet shares.

## What is new

- **Controlled wallet maintenance:** the owner can change both payout recipients only while intake is paused and all job escrow and bonds are settled. Existing job funds cannot be redirected; reentrancy protection also blocks callback-time rotation.
- **Two-step ownership:** the current owner proposes and the recipient accepts. Renunciation is disabled to preserve maintenance and pause recovery. The owner remains trusted for operational controls.
- **Verified browser startup:** per-request CSP nonces allow framework hydration while blocking untrusted HTML scripts; wallet controls meet contrast checks.
- **Clear owner console:** reviewed actions for recipient rotation, ownership proposal and acceptance; on-chain preflight checks, current/pending owner display, account-change protection and useful errors. Manager controls work without optional ENS job pages.
- **Safer deployment handover:** Hardhat pauses intake after deployment and records whether ownership acceptance is still required. A proposal is never reported as a completed handover.
- **Updated dependencies and tooling:** Node 22.23.2, Next 15.5.24, updated wallet libraries, ethers 6.17.0, integrity-pinned Web3 4.16.0 and patched dependency overrides. Production/deployment audit checks run in CI.
- **Efficient contract changes:** reuse the existing linked URI library and remove a duplicate eligibility scan. Manager runtime is 24,503 bytes under the EIP-170 limit.
- Updated ABIs, deployment registry, standalone artifacts and operator guides. Public-network Truffle signing is retired; Hardhat is the supported deployment path.

USDC and the 30%/10% percentages remain fixed. The validator budget defaults to 8%, is bounded to 1–60%, and is fixed for each job when posted; owner updates apply to new jobs. A no-vote liveness completion pays 30% / 10% / 60%.

## Deployment and compatibility

**A fresh v0.7.0 deployment is required.** This release publishes software; it does not deploy or upgrade a live contract or move funds. Both real recipient addresses must be supplied. Examples leave them blank and fail closed. Existing contracts and escrow remain on their original instances.

Ethereum mainnet uses native six-decimal Circle USDC at `0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48`. ETH is still needed for gas. Sepolia uses Circle test USDC. USDC issuer pauses or blocked recipients can revert the entire settlement; wallet rotation cannot reroute already reserved funds.

Read the [owner guide](https://github.com/MontrealAI/AGIJobManager/blob/v0.7.0/docs/OWNER_CONTROLS.md), [payout rules](https://github.com/MontrealAI/AGIJobManager/blob/v0.7.0/docs/USDC_PAYOUT_SPLIT.md) and [Hardhat deployment guide](https://github.com/MontrealAI/AGIJobManager/blob/v0.7.0/hardhat/README.md).

## Verification and remaining limits

Local verification includes 397 contract tests, 126 UI tests, 35 frozen-console checks, 15 browser/navigation/accessibility/header cases (including the injected-script regression), clean-install owner/payout regressions, build/lint/type checks and standalone verification. Publication requires successful contract, browser/UI, documentation and security CI on the exact source commit, plus reproducible archives and verified asset digests.

At preparation, UI and root production dependency audits report zero known findings. The full Hardhat audit has 14 low findings and no moderate/high/critical findings. **Legacy local Truffle/Ganache test dependencies retain high and critical advisories** and must not receive production keys. See [dependency security scope](https://github.com/MontrealAI/AGIJobManager/blob/v0.7.0/docs/DEPENDENCY_SECURITY.md). Automated verification is not an independent security audit or certification of a live deployment.

## Downloads

- **AGIJobManager-v0.7.0-COMPLETE.zip** — pinned source, console, release guidance and evidence.
- **agijobmanager-usdc.html** — standalone USDC console.
- **RELEASE_MANIFEST.json** — source identity and per-file SHA-256 inventory.
- **SHA256SUMS.txt** — download integrity checks.
