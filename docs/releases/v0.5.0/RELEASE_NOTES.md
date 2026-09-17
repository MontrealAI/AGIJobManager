# v0.5.0 — USDC-only settlement

All job payouts, escrow, agent/validator/dispute bonds, rewards, refunds and treasury withdrawals now use native Circle USDC with six decimals.

## Changes

- Immutable settlement token, with canonical Ethereum mainnet and Sepolia address checks at deployment. Other public chains are rejected; local test chains permit six-decimal mocks.
- Six-decimal economic defaults and reputation scaling. One USDC is `1000000` base units; fractional inputs retain every micro-USDC and reject excess precision.
- USDC APIs: `usdcToken()`, `withdrawUSDC`, `withdrawableUSDC`, `USDCWithdrawn`. No settlement-token setter remains.
- Current interfaces check the manager, network, canonical USDC and decimals before transactions. New storage namespaces prevent reuse of old amount drafts.
- Bridge/vault conversion flows and incompatible snapshot deployment migrations retired. Previous versioned consoles remain available in the v0.4.0 tag.
- Regenerated ABIs, source bundles, deployment registry and migration documentation. USDC transfer-restriction regressions cover atomic rollback and exact refunds.

## Deployment and compatibility

**A fresh USDC manager deployment is required. This release does not deploy or upgrade live contracts.** The default registry says `deployment-required`; interfaces do not point to a historical manager. Existing jobs and balances remain on their original contracts and must be handled there.

Do not reuse legacy raw amounts, approvals or snapshots. ETH is still used for gas. ENS/NFT identity credentials remain separate from settlement. USDC issuer pauses and blocked addresses can prevent transfers.

Read the [USDC migration guide](https://github.com/MontrealAI/AGIJobManager/blob/v0.5.0/docs/USDC_MIGRATION.md) and the attached validation evidence. Canonical token addresses come from [Circle's registry](https://developers.circle.com/stablecoins/usdc-contract-addresses).

## Assets

- **AGIJobManager-v0.5.0-COMPLETE.zip** — complete pinned source, primary console, guidance and evidence.
- **agijobmanager-usdc.html** — standalone USDC console.
- **RELEASE_MANIFEST.json** — source identity and SHA-256 payload inventory.
- **SHA256SUMS.txt** — download integrity checks.

Automated tests and static analysis do not constitute an independent security audit or certification of a live deployment. See `VALIDATION.md` for the exact successful CI runs and their scope.
