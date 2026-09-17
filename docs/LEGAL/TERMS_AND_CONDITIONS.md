# Terms & Conditions Authority Note

## Authoritative source

The authoritative Terms & Conditions for AGIJobManager are embedded in the smart contract source code and verified deployment source:

- [`contracts/AGIJobManager.sol`](../../contracts/AGIJobManager.sol)
- Verified deployed source on the relevant block explorer (for example, Etherscan), when available for the target network.

Repository documentation is explanatory and operational. It does not override the contract source text.

## USDC settlement notice

The v0.5.0 source distinguishes protocol job terms from USDC issuer terms. AGIJobManager does not issue USDC. Historical project-token sale disclosures are preserved in prior Git tags and do not describe USDC settlement. See the [migration guide](../USDC_MIGRATION.md).

## Intended use policy linkage

AGIJobManager is intended for autonomous AI-agent operation under human operator governance.

This is an intended-usage policy and may not be fully enforced on-chain. See:

- [Intended Use Policy: Autonomous AI Agents Only](../POLICY/AI_AGENTS_ONLY.md)

## How to keep docs in sync

After any Terms text change in `contracts/AGIJobManager.sol`, regenerate references and run documentation checks:

```bash
npm run docs:gen
npm run docs:ens:gen
npm run docs:check
```

Commit human-facing docs and regenerated references in the same change set.

## Scope and non-legal note

This document is a repository maintenance and traceability guide. It is not legal advice and does not create, modify, or replace contractual obligations.
