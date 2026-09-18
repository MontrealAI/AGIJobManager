# Protocol terms: authority, acceptance and versioning

## Three distinct authorities

1. The [MIT License](../../LICENSE) governs software permissions and its warranty/liability provisions. These notices add no restriction on licensed use, including commercial use.
2. Verified deployed code determines on-chain behavior. Source comments and the console explain that behavior and propose risk allocation; they cannot override applicable law or a valid agreement.
3. An actual operator's separately identified, validly accepted terms govern its service to the extent enforceable. A source comment, ENS name, transaction or publication alone does not prove legal identity, authority, notice or acceptance.

The canonical v1.0.4 protocol text is the opening comment in [`contracts/AGIJobManager.sol`](../../contracts/AGIJobManager.sol). The standalone [USDC console](../../ui/agijobmanager-usdc.html) reproduces that exact text. Read the [legal center](README.md), [publisher notice](PUBLISHER_NOTICE.md) and [operator template](OPERATOR_NOTICE_TEMPLATE.md) for deployment-specific work.

## What changes in v1.0.4

The notice removes automatic-acceptance and blanket regulatory-immunity claims, discloses retained powers and fees, preserves mandatory rights and distinguishes MIT from an operator's service agreement. No Solidity function, storage layout, payout, refund, default policy or power changes. Publication cannot rewrite historical source or adopt terms for existing users. Preserve earlier jobs and agreements; arrange prospective amendments through a valid process.

Fresh managers retain the v1.0.3 disabled NFT-admission default and paused intake. USDC issuer terms remain separate. Historical token-sale disclosures remain in prior tags and do not describe current USDC settlement.

## Console acknowledgement

The console starts unchecked and does not restore a checkbox from local storage. Account, network and manager changes invalidate acknowledgement and reviewed actions. Reopening or restoring the page requires fresh acknowledgement. This safeguard does not prove a binding contract, a jurisdictional waiver or on-chain access restriction. It does not certify that the operator supplied appropriate terms or completed legal review.

## Maintaining consistency

After changing the opening source comment, synchronize the console and check the documents:

```bash
npm run docs:terms
npm run docs:gen
npm run docs:check
```

`docs:check` compares the embedded text with the source and fails on drift. Commit both together. The broader UI links to the versioned legal center; historical interfaces retain their notices. The [AI-agent policy](../POLICY/AI_AGENTS_ONLY.md) describes intended operation, not a regulatory exemption or an alteration of MIT permissions.

These are general drafting and operational materials. A qualified adviser must assess the actual arrangement for an opinion on legal status or enforceability.
